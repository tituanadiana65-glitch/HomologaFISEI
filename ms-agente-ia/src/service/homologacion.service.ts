import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AgenteService } from './agente.service';
import { ClientesService } from './clientes.service';
import { armarInforme } from './informe';
import { PrismaService } from '../repository/prisma.service';
import { EventosService } from '../events/eventos.service';
import type { Informe, MateriaCatalogo, ParteJunta, PedidoComparar, PedidoExterno, PedidoHomologar, PedidoJuntas } from '../dto/tipos';

import { unirConCatalogo } from './record';

const coma = (n: number) => n.toFixed(1).replace('.', ',');

// HU-26 · Nota de varias materias: promedio según sus créditos (sobre 10, con 2 decimales)
export function promedioPorCreditos(partes: { nota: number; creditos: number }[]): number {
  const creditos = partes.reduce((s, p) => s + p.creditos, 0);
  const suma = partes.reduce((s, p) => s + p.nota * p.creditos, 0);
  return Math.round((creditos > 0 ? suma / creditos : partes.reduce((s, p) => s + p.nota, 0) / partes.length) * 100) / 100;
}

// HU-26 · Junta los sílabos de las partes, cada uno con su título, sin pasar el largo que acepta la IA
export function juntarSilabos(partes: { nombre: string; silabo?: string }[], max = 12_000): string {
  const porParte = Math.floor(max / partes.length) - 40;
  return partes.map((p) => `--- ${p.nombre} ---\n${(p.silabo ?? '').slice(0, porParte)}`).join('\n\n');
}

const notaDe = (p: ParteJunta) => (p.notaOriginal !== undefined && p.escala && p.escala !== 10 ? `${p.notaOriginal}/${p.escala}` : coma(p.nota));

@Injectable()
export class HomologacionService {
  constructor(
    private readonly agente: AgenteService,
    private readonly clientes: ClientesService,
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
  ) {}

  private validar(p: PedidoComparar) {
    if (!p?.codigoAprobada || !p?.codigoNueva) {
      throw new BadRequestException('Envía codigoAprobada y codigoNueva');
    }
  }

  // T11 · Solo contenidos (RN-01)
  async comparar(p: PedidoComparar) {
    this.validar(p);
    const [aprobada, nueva, minimo] = await Promise.all([
      this.clientes.materia(p.codigoAprobada),
      this.clientes.materia(p.codigoNueva),
      this.clientes.minimoContenidos(),
    ]);
    return this.agente.comparar(aprobada, nueva, minimo);
  }

  // T44 · Solo contenidos (RN-01): sílabo de otra universidad frente al plan analítico de una materia de la FISEI
  async compararSilabo(p: { silabo: string; codigoNueva: string }) {
    if (!p?.silabo?.trim() || !p?.codigoNueva) throw new BadRequestException('Envía silabo y codigoNueva');
    const [nueva, minimo] = await Promise.all([this.clientes.materia(p.codigoNueva), this.clientes.minimoContenidos()]);
    return this.agente.compararConSilabo(p.silabo, nueva, minimo);
  }

  // T12 · Resultado completo: contenidos + reglas, con informe guardado
  async homologar(p: PedidoHomologar): Promise<Informe> {
    this.validar(p);
    const [aprobada, nueva, minimo] = await Promise.all([
      this.clientes.materia(p.codigoAprobada),
      this.clientes.materia(p.codigoNueva),
      this.clientes.minimoContenidos(),
    ]);
    const [contenidos, reglas] = await Promise.all([
      this.agente.comparar(aprobada, nueva, minimo),
      this.clientes.evaluar(
        { creditos: aprobada.creditos, horas: aprobada.horasTotales, nota: p.nota, anio: p.anio },
        { creditos: nueva.creditos, horas: nueva.horasTotales },
      ),
    ]);
    return this.guardar(p, armarInforme(aprobada, nueva, contenidos, reglas, minimo));
  }

  // T46 · Materia de otra universidad: contenidos del sílabo (RN-01) + reglas con los datos que escribió el estudiante
  async homologarExterna(p: PedidoExterno): Promise<Informe> {
    if (!p?.codigoAprobada || !p?.codigoNueva || !p?.silabo?.trim()) throw new BadRequestException('Envía codigoAprobada, codigoNueva y silabo');
    if (!(p.creditos > 0) || !(p.horas > 0)) throw new BadRequestException(`La materia ${p.codigoAprobada} necesita créditos y horas mayores a 0`);
    const [nueva, minimo] = await Promise.all([this.clientes.materia(p.codigoNueva), this.clientes.minimoContenidos()]);
    // La "aprobada" no está en el catálogo: sus datos son los del mensaje
    const aprobada: MateriaCatalogo = { codigo: p.codigoAprobada, nombre: p.nombre, creditos: p.creditos, horasTotales: p.horas, unidades: [] };
    const [contenidos, reglas] = await Promise.all([
      this.agente.compararConSilabo(p.silabo, nueva, minimo),
      this.clientes.evaluar(
        { creditos: p.creditos, horas: p.horas, nota: p.nota, anio: p.anio },
        { creditos: nueva.creditos, horas: nueva.horasTotales },
      ),
    ]);
    const externo = { parecido: p.parecido, notaOriginal: p.notaOriginal, escala: p.escala, nota: p.nota };
    return this.guardar(p, armarInforme(aprobada, nueva, contenidos, reglas, minimo, externo));
  }

  // HU-26 (RN-10) · Varias materias aprobadas juntas frente a una materia nueva:
  // temas de todas juntas (RN-01), créditos y horas sumados, nota promedio según créditos y año de la más antigua.
  async homologarJuntas(p: PedidoJuntas): Promise<Informe> {
    if (!p?.codigoNueva || !p?.partes || p.partes.length < 2) throw new BadRequestException('Envía codigoNueva y al menos dos materias');
    const [nueva, minimo] = await Promise.all([this.clientes.materia(p.codigoNueva), this.clientes.minimoContenidos()]);
    const nombre = p.partes.map((x) => x.nombre).join(' + ');
    const codigo = p.partes.map((x) => x.codigo).join(' + ');
    const creditos = p.partes.reduce((s, x) => s + x.creditos, 0);
    const horas = p.partes.reduce((s, x) => s + x.horas, 0);
    const nota = promedioPorCreditos(p.partes);
    const anio = Math.min(...p.partes.map((x) => x.anio));
    const externa = p.partes.some((x) => x.silabo !== undefined);
    // Las unidades de todas las partes, una tras otra (UTA)
    const unidades = p.partes.flatMap((x) => (x.unidades ?? []).map((u) => ({ ...u, contenido: `${x.nombre}: ${u.contenido}` }))).map((u, i) => ({ ...u, numero: i + 1 }));
    const aprobada: MateriaCatalogo = { codigo, nombre, creditos, horasTotales: horas, unidades };
    const [contenidos, reglas] = await Promise.all([
      externa ? this.agente.compararConSilabo(juntarSilabos(p.partes), nueva, minimo) : this.agente.comparar(aprobada, nueva, minimo),
      this.clientes.evaluar({ creditos, horas, nota, anio }, { creditos: nueva.creditos, horas: nueva.horasTotales }),
    ]);
    const informe = armarInforme(aprobada, nueva, contenidos, reglas, minimo, p.parecido !== undefined ? { parecido: p.parecido } : undefined);
    const detalle = p.partes.map((x) => `${x.nombre} ${notaDe(x)}`).join(' y ');
    informe.causas = informe.causas.map((c) => {
      if (c.regla === 'RN-01') return { ...c, causa: `Temas de ${nombre} juntas. ${c.causa}` };
      if (c.regla === 'RN-02') return { ...c, causa: `Créditos sumados de las ${p.partes.length} materias. ${c.causa}` };
      if (c.regla === 'RN-03') return { ...c, causa: `Horas sumadas de las ${p.partes.length} materias. ${c.causa}` };
      if (c.regla === 'RN-04') return { ...c, causa: c.causa.replace(/^Nota [\d.,]+/, `Promedio ${coma(nota)}/10 según créditos (${detalle})`) };
      if (c.regla === 'RN-05') return { ...c, causa: `Se toma la más antigua (${anio}). ${c.causa}` };
      return c;
    });
    informe.juntas = p.partes.map((x) => x.nombre);
    return this.guardar({ codigoAprobada: codigo, codigoNueva: p.codigoNueva, nota, anio }, informe);
  }

  // Lee un récord académico (PDF ya subido a ms-documentos). Con la carrera de origen (UTA) une cada materia con el catálogo.
  async leerRecord(p: { documentoId?: number; carreraOrigen?: string }) {
    if (!p?.documentoId) throw new BadRequestException('Envía el documentoId del récord');
    const texto = await this.clientes.textoSilabo(p.documentoId);
    if (!texto.trim()) throw new BadRequestException('El récord no tiene texto que se pueda leer');
    let materias = await this.agente.leerRecord(texto);
    if (p.carreraOrigen) materias = unirConCatalogo(materias, await this.clientes.asignaturasConDatos(p.carreraOrigen));
    return {
      materias,
      aprobadas: materias.filter((m) => m.estado === 'APROBADA').length,
      reprobadas: materias.filter((m) => m.estado === 'REPROBADA').length,
    };
  }

  // Guarda el informe, publica el evento y devuelve el informe con su id y fecha
  private async guardar(p: { codigoAprobada: string; codigoNueva: string; nota?: number; anio?: number }, informe: Informe): Promise<Informe> {
    const guardado = await this.prisma.homologacion.create({
      data: {
        codigoAprobada: p.codigoAprobada,
        codigoNueva: p.codigoNueva,
        nota: p.nota ?? null,
        anio: p.anio ?? null,
        resultado: informe.resultado,
        porcentaje: informe.porcentaje,
        informe: JSON.stringify(informe),
      },
    });
    const final = { ...informe, id: guardado.id, fecha: guardado.fecha.toISOString() };
    await this.eventos.publicar('homologacion.completada', { id: final.id, resultado: final.resultado, aprobada: final.aprobada, nueva: final.nueva });
    return final;
  }

  async listar() {
    const filas = await this.prisma.homologacion.findMany({ orderBy: { fecha: 'desc' }, take: 50 });
    return filas.map((f) => ({ id: f.id, codigoAprobada: f.codigoAprobada, codigoNueva: f.codigoNueva, resultado: f.resultado, porcentaje: f.porcentaje, fecha: f.fecha }));
  }

  async informe(id: number): Promise<Informe> {
    const f = await this.prisma.homologacion.findUnique({ where: { id } });
    if (!f) throw new NotFoundException(`No existe la homologación ${id}`);
    return { ...(JSON.parse(f.informe) as Informe), id: f.id, fecha: f.fecha.toISOString() };
  }
}
