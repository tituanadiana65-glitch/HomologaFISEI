import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventosService } from '../events/eventos.service';
import { ClientesService } from './clientes.service';
import { HomologacionService } from './homologacion.service';
import { AgenteService } from './agente.service';
import { buscarEquivalente, buscarPorNombre, nombreBase } from './equivalencia';
import type { Informe, MateriaCatalogo, MateriaTexto, ParteJunta, Resultado } from '../dto/tipos';

// Mensaje solicitud.enviada (Sprint 3). INTERNO sigue igual que en el Sprint 2: solo codigo, nota y anio.
interface MateriaEnviada {
  codigo: string; // EXTERNO: EXT-CALCULO-II
  nota: number;
  anio: number;
  nombre?: string; // solo EXTERNO
  creditos?: number;
  horas?: number;
  notaOriginal?: number;
  escala?: number;
  silaboId?: number;
}

interface SolicitudEnviada {
  solicitudId: number;
  tipo?: 'INTERNO' | 'EXTERNO'; // si no viene, es INTERNO
  carreraDestino: string;
  materias: MateriaEnviada[];
}

interface Adicional {
  codigoNueva: string;
  resultado: Resultado;
  informe: Informe | null;
}

interface ResultadoMateria {
  codigoAprobada: string;
  codigoNueva: string | null;
  resultado: Resultado;
  informe: Informe | null;
  juntoCon?: string[]; // HU-26 · otras materias aprobadas evaluadas junto con esta
  adicionales?: Adicional[]; // HU-29 · otras materias nuevas que también cubre esta
}

// A qué materia (o materias) de la carrera de destino apunta cada materia aprobada, antes de evaluar
interface Asignacion {
  m: MateriaEnviada;
  nombre: string;
  principal: { codigo: string; parecido: number } | null;
  exacta: boolean; // mismo nombre: nunca se junta con otra
  otras: { codigo: string; parecido: number; porNombre: boolean }[]; // HU-29
  silabo?: string; // otra universidad
  aprobada?: MateriaCatalogo; // UTA
  aviso?: string; // HU-26 · es una parte de la materia nueva
}

// Pausa entre materias por el límite de consultas por minuto de Gemini (en las pruebas: IA_PAUSA_MS=0)
const pausa = () => Number(process.env.IA_PAUSA_MS ?? 4000);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class SolicitudesAgenteService implements OnModuleInit {
  private readonly log = new Logger(SolicitudesAgenteService.name);

  constructor(
    private readonly eventos: EventosService,
    private readonly clientes: ClientesService,
    private readonly homologacion: HomologacionService,
    private readonly agente: AgenteService,
  ) {}

  onModuleInit() {
    void this.eventos.escuchar('ms-agente-ia.solicitudes', 'solicitud.enviada', (d) => this.homologarSolicitud(d));
  }

  async homologarSolicitud(d: SolicitudEnviada) {
    let destino: { codigo: string; nombre: string }[];
    try {
      destino = await this.clientes.asignaturas(d.carreraDestino);
    } catch (e) {
      // sin catálogo no se puede buscar equivalentes: todas quedan pendientes, pero la solicitud no se pierde
      this.log.warn(`Solicitud ${d.solicitudId}: ${(e as Error).message}`);
      const pendientes: ResultadoMateria[] = d.materias.map((m) => ({ codigoAprobada: m.codigo, codigoNueva: null, resultado: 'Pendiente', informe: null }));
      await this.eventos.publicar('solicitud.homologada', { solicitudId: d.solicitudId, resultados: pendientes });
      return;
    }
    // Candidatas con sus unidades: se piden una sola vez por solicitud (son ~40 llamadas al catálogo)
    let candidatasCache: Promise<MateriaTexto[]> | undefined;
    const candidatas = () => (candidatasCache ??= this.clientes.candidatas(d.carreraDestino));
    const externa = d.tipo === 'EXTERNO';
    // Pausa entre consultas a la IA (no antes de la primera)
    let primera = true;
    const pausar = async () => {
      if (!primera) await esperar(pausa());
      primera = false;
    };

    // 1 · A qué materia nueva apunta cada materia aprobada
    const porCodigo = new Map<string, ResultadoMateria>();
    const asignaciones: Asignacion[] = [];
    for (const m of d.materias) {
      try {
        const a = externa ? await this.asignarExterna(m, destino, candidatas, pausar) : await this.asignarUta(m, destino, d.materias);
        if (a) asignaciones.push(a);
        else porCodigo.set(m.codigo, { codigoAprobada: m.codigo, codigoNueva: null, resultado: 'Sin materia equivalente', informe: null });
      } catch (e) {
        // una materia con problema no detiene a las demás
        this.log.warn(`Solicitud ${d.solicitudId}, materia ${m.codigo}: ${(e as Error).message}`);
        porCodigo.set(m.codigo, { codigoAprobada: m.codigo, codigoNueva: null, resultado: 'Pendiente', informe: null });
      }
    }

    // 2 · HU-26 (RN-10): si dos o más apuntan a la misma materia nueva sin ser de igual nombre, se evalúan juntas
    const grupos = new Map<string, Asignacion[]>();
    for (const a of asignaciones) {
      if (!a.principal || a.exacta) continue;
      grupos.set(a.principal.codigo, [...(grupos.get(a.principal.codigo) ?? []), a]);
    }

    // 3 · Evaluar
    for (const a of asignaciones) {
      if (porCodigo.has(a.m.codigo)) continue;
      const grupo = a.principal && !a.exacta ? (grupos.get(a.principal.codigo) ?? []) : [];
      try {
        await pausar();
        if (grupo.length >= 2) {
          for (const r of await this.evaluarJuntas(grupo, externa)) porCodigo.set(r.codigoAprobada, r);
          continue;
        }
        porCodigo.set(a.m.codigo, await this.evaluarSola(a, externa, pausar));
      } catch (e) {
        this.log.warn(`Solicitud ${d.solicitudId}, materia ${a.m.codigo}: ${(e as Error).message}`);
        for (const x of grupo.length >= 2 ? grupo : [a]) porCodigo.set(x.m.codigo, { codigoAprobada: x.m.codigo, codigoNueva: null, resultado: 'Pendiente', informe: null });
      }
    }

    const resultados = d.materias.map((m) => porCodigo.get(m.codigo)!);
    await this.eventos.publicar('solicitud.homologada', { solicitudId: d.solicitudId, resultados });
    this.log.log(`Solicitud ${d.solicitudId}: ${resultados.length} materias homologadas`);
  }

  // UTA · por nombre: igual (una con una), "Física I" → "Física" (HU-26) o "Física" → "Física I" y "Física II" (HU-29)
  private async asignarUta(m: MateriaEnviada, destino: { codigo: string; nombre: string }[], enviadas: MateriaEnviada[]): Promise<Asignacion | null> {
    const aprobada = await this.clientes.materia(m.codigo);
    const n = buscarPorNombre(aprobada.nombre, destino);
    const base = { m, nombre: aprobada.nombre, aprobada };
    if (n.exacta) return { ...base, principal: { codigo: n.exacta.codigo, parecido: 100 }, exacta: true, otras: [] };
    if (n.partes.length) {
      const [primera, ...resto] = n.partes;
      return { ...base, principal: { codigo: primera.codigo, parecido: 100 }, exacta: true, otras: resto.map((x) => ({ codigo: x.codigo, parecido: 100, porNombre: true })) };
    }
    if (!n.base) return null;
    return { ...base, principal: { codigo: n.base.codigo, parecido: 100 }, exacta: false, otras: [], aviso: await this.avisoUta(aprobada, n.base.nombre, enviadas) };
  }

  // HU-26 · "Para cubrir FÍSICA también cuenta FÍSICA II, que no está en tu solicitud": las partes de la carrera de origen que faltan
  private async avisoUta(aprobada: MateriaCatalogo, nueva: string, enviadas: MateriaEnviada[]): Promise<string> {
    const generico = `Esta materia es una parte de ${nueva}. Si aprobaste las otras partes, regístralas para evaluarlas juntas.`;
    const carrera = aprobada.carrera?.codigo;
    if (!carrera) return generico;
    try {
      const origen = await this.clientes.asignaturas(carrera);
      const registradas = new Set(enviadas.map((e) => e.codigo));
      const faltan = origen.filter((o) => o.codigo !== aprobada.codigo && !registradas.has(o.codigo) && nombreBase(o.nombre) === nombreBase(aprobada.nombre));
      if (!faltan.length) return generico;
      return `Para cubrir ${nueva} también cuenta ${faltan.map((f) => f.nombre).join(' y ')}, que no está en tu solicitud. Si la aprobaste, regístrala para evaluarlas juntas.`;
    } catch {
      return generico;
    }
  }

  // Otra universidad · primero por nombre (igual, por partes o por su nombre base) y, si no hay, por los temas del sílabo (T43)
  private async asignarExterna(
    m: MateriaEnviada,
    destino: { codigo: string; nombre: string }[],
    candidatas: () => Promise<MateriaTexto[]>,
    pausar: () => Promise<void>,
  ): Promise<Asignacion | null> {
    // Sin sílabo no hay con qué comparar. No se deja Pendiente: reintentar nunca lo arreglaría y la solicitud no terminaría.
    if (!m.silaboId) {
      this.log.warn(`La materia ${m.codigo} no trae sílabo: se marca sin materia equivalente`);
      return null;
    }
    const silabo = await this.clientes.textoSilabo(m.silaboId);
    const nombre = m.nombre ?? m.codigo;
    const base = { m, nombre, silabo };
    const n = buscarPorNombre(nombre, destino);
    if (n.exacta) return { ...base, principal: { codigo: n.exacta.codigo, parecido: 100 }, exacta: true, otras: [] };
    if (n.partes.length) {
      const [primera, ...resto] = n.partes;
      return { ...base, principal: { codigo: primera.codigo, parecido: 100 }, exacta: true, otras: resto.map((x) => ({ codigo: x.codigo, parecido: 100, porNombre: true })) };
    }
    if (n.base) {
      const aviso = `Esta materia es una parte de ${n.base.nombre}. Si aprobaste las otras partes (por ejemplo, la II), regístralas para evaluarlas juntas.`;
      return { ...base, principal: { codigo: n.base.codigo, parecido: 100 }, exacta: false, otras: [], aviso };
    }
    await pausar();
    const parecida = await this.agente.elegirParecida(silabo, await candidatas());
    if (!parecida) return null;
    return {
      ...base,
      principal: { codigo: parecida.codigo, parecido: parecida.parecido },
      exacta: false,
      otras: (parecida.otras ?? []).map((o) => ({ ...o, porNombre: false })),
    };
  }

  // Una materia con su materia nueva y, si cubre más (HU-29), también con las demás
  private async evaluarSola(a: Asignacion, externa: boolean, pausar: () => Promise<void>): Promise<ResultadoMateria> {
    const informe = await this.evaluarUna(a, a.principal!.codigo, a.principal!.parecido, externa);
    if (a.aviso && informe.resultado !== 'Homologable') informe.aviso = a.aviso;
    const r: ResultadoMateria = { codigoAprobada: a.m.codigo, codigoNueva: a.principal!.codigo, resultado: informe.resultado, informe };
    const adicionales: Adicional[] = [];
    for (const o of a.otras) {
      await pausar();
      const inf = await this.evaluarUna(a, o.codigo, o.parecido, externa);
      // Las que salen por el nombre se muestran siempre; las que eligió la IA por temas, solo si se homologan
      if (o.porNombre || inf.resultado === 'Homologable' || inf.resultado === 'Pendiente') adicionales.push({ codigoNueva: o.codigo, resultado: inf.resultado, informe: inf });
    }
    if (!adicionales.length) return r;
    // Si alguna quedó Pendiente, toda la materia queda Pendiente para que "Reintentar" la vuelva a evaluar completa
    if (adicionales.some((x) => x.resultado === 'Pendiente')) return { codigoAprobada: a.m.codigo, codigoNueva: null, resultado: 'Pendiente', informe: null };
    return { ...r, adicionales };
  }

  private evaluarUna(a: Asignacion, codigoNueva: string, parecido: number, externa: boolean): Promise<Informe> {
    if (!externa) return this.homologacion.homologar({ codigoAprobada: a.m.codigo, codigoNueva, nota: a.m.nota, anio: a.m.anio });
    return this.homologacion.homologarExterna({
      codigoAprobada: a.m.codigo,
      nombre: a.nombre,
      silabo: a.silabo!,
      codigoNueva,
      creditos: a.m.creditos ?? 0,
      horas: a.m.horas ?? 0,
      nota: a.m.nota,
      anio: a.m.anio,
      parecido,
      notaOriginal: a.m.notaOriginal,
      escala: a.m.escala,
    });
  }

  // HU-26 · Todas las materias del grupo juntas frente a su materia nueva; cada una recibe el mismo resultado
  private async evaluarJuntas(grupo: Asignacion[], externa: boolean): Promise<ResultadoMateria[]> {
    const codigoNueva = grupo[0].principal!.codigo;
    const partes: ParteJunta[] = grupo.map((a) => ({
      codigo: a.m.codigo,
      nombre: a.nombre,
      creditos: externa ? (a.m.creditos ?? 0) : (a.aprobada?.creditos ?? 0),
      horas: externa ? (a.m.horas ?? 0) : (a.aprobada?.horasTotales ?? 0),
      nota: a.m.nota,
      anio: a.m.anio,
      ...(a.m.notaOriginal !== undefined ? { notaOriginal: a.m.notaOriginal, escala: a.m.escala } : {}),
      ...(externa ? { silabo: a.silabo ?? '' } : { unidades: a.aprobada?.unidades ?? [] }),
    }));
    const parecido = externa ? Math.min(...grupo.map((a) => a.principal!.parecido)) : undefined;
    const informe = await this.homologacion.homologarJuntas({ partes, codigoNueva, ...(parecido !== undefined ? { parecido } : {}) });
    return grupo.map((a) => ({
      codigoAprobada: a.m.codigo,
      codigoNueva,
      resultado: informe.resultado,
      informe,
      juntoCon: grupo.filter((x) => x !== a).map((x) => x.m.codigo),
    }));
  }

  // T43 · Materia de otra universidad: primero por nombre y, si no hay una igual, por los temas del sílabo.
  // Devuelve null si ninguna materia de la carrera de destino se parece (parecido menor a 50).
  async buscarMateriaParecida(m: MateriaEnviada, silabo: string, destino: { codigo: string; nombre: string }[], candidatas: () => Promise<MateriaTexto[]>) {
    const igual = m.nombre ? buscarEquivalente(m.nombre, destino) : undefined;
    if (igual) return { codigo: igual.codigo, parecido: 100 };
    return this.agente.elegirParecida(silabo, await candidatas());
  }
}
