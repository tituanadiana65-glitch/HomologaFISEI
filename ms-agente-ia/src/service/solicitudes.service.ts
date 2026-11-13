import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventosService } from '../events/eventos.service';
import { ClientesService } from './clientes.service';
import { HomologacionService } from './homologacion.service';
import { AgenteService } from './agente.service';
import { buscarEquivalente } from './equivalencia';
import type { Informe, MateriaTexto, Resultado } from '../dto/tipos';

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

interface ResultadoMateria {
  codigoAprobada: string;
  codigoNueva: string | null;
  resultado: Resultado;
  informe: Informe | null;
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
    const resultados: ResultadoMateria[] = [];
    for (const m of d.materias) {
      try {
        if (d.tipo === 'EXTERNO') {
          resultados.push(await this.materiaExterna(m, destino, candidatas));
          await esperar(pausa());
          continue;
        }
        const aprobada = await this.clientes.materia(m.codigo);
        const nueva = buscarEquivalente(aprobada.nombre, destino);
        if (!nueva) {
          resultados.push({ codigoAprobada: m.codigo, codigoNueva: null, resultado: 'Sin materia equivalente', informe: null });
          continue;
        }
        const informe = await this.homologacion.homologar({ codigoAprobada: m.codigo, codigoNueva: nueva.codigo, nota: m.nota, anio: m.anio });
        resultados.push({ codigoAprobada: m.codigo, codigoNueva: nueva.codigo, resultado: informe.resultado, informe });
        await esperar(pausa());
      } catch (e) {
        // una materia con problema no detiene a las demás
        this.log.warn(`Solicitud ${d.solicitudId}, materia ${m.codigo}: ${(e as Error).message}`);
        resultados.push({ codigoAprobada: m.codigo, codigoNueva: null, resultado: 'Pendiente', informe: null });
      }
    }
    await this.eventos.publicar('solicitud.homologada', { solicitudId: d.solicitudId, resultados });
    this.log.log(`Solicitud ${d.solicitudId}: ${resultados.length} materias homologadas`);
  }

  // T43 · Materia de otra universidad: primero por nombre y, si no hay una igual, por los temas del sílabo.
  // Devuelve null si ninguna materia de la carrera de destino se parece (parecido menor a 50).
  async buscarMateriaParecida(m: MateriaEnviada, silabo: string, destino: { codigo: string; nombre: string }[], candidatas: () => Promise<MateriaTexto[]>) {
    const igual = m.nombre ? buscarEquivalente(m.nombre, destino) : undefined;
    if (igual) return { codigo: igual.codigo, parecido: 100 };
    return this.agente.elegirParecida(silabo, await candidatas());
  }

  private async materiaExterna(m: MateriaEnviada, destino: { codigo: string; nombre: string }[], candidatas: () => Promise<MateriaTexto[]>): Promise<ResultadoMateria> {
    if (!m.silaboId) throw new Error(`La materia ${m.codigo} no trae sílabo para compararla`);
    const silabo = await this.clientes.textoSilabo(m.silaboId);
    const parecida = await this.buscarMateriaParecida(m, silabo, destino, candidatas);
    if (!parecida) return { codigoAprobada: m.codigo, codigoNueva: null, resultado: 'Sin materia equivalente', informe: null };
    // T44 + T46: contenidos del sílabo y reglas con los créditos, horas, nota y año que escribió el estudiante
    const informe = await this.homologacion.homologarExterna({
      codigoAprobada: m.codigo,
      nombre: m.nombre ?? m.codigo,
      silabo,
      codigoNueva: parecida.codigo,
      creditos: m.creditos ?? 0,
      horas: m.horas ?? 0,
      nota: m.nota,
      anio: m.anio,
      parecido: parecida.parecido,
      notaOriginal: m.notaOriginal,
      escala: m.escala,
    });
    return { codigoAprobada: m.codigo, codigoNueva: parecida.codigo, resultado: informe.resultado, informe };
  }
}
