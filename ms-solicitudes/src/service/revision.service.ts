import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../repository/prisma.service';
import { revisarRequisitos } from './validaciones';

// Coordinador y docente (definido por el equipo el 23/11/2026). No hay estudiantes en el sistema: el coordinador
// registra la solicitud que el estudiante entregó y elige al docente; el docente sube el expediente, lo envía al
// agente, revisa el análisis (puede cambiar resultados con su comentario) y envía el resultado al coordinador.
export const RESULTADOS = ['Homologable', 'No homologable', 'Sin materia equivalente'];
const CON_RESULTADO = ['RESULTADO_LISTO', 'REVISADA'];

export interface Persona {
  id: number;
  nombre: string;
}

// Resultado que vale: el del docente si lo cambió; si no, el del agente
export const resultadoFinal = (m: { resultado?: string | null; resultadoDocente?: string | null }) => m.resultadoDocente ?? m.resultado ?? null;

@Injectable()
export class RevisionService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Coordinador ----------
  listarCoordinacion() {
    return this.prisma.solicitud.findMany({
      include: { _count: { select: { materias: true } } },
      orderBy: { id: 'desc' },
    });
  }

  async verCoordinacion(id: number) {
    const s = await this.prisma.solicitud.findUnique({ where: { id }, include: { materias: true } });
    if (!s) throw new NotFoundException(`No existe la solicitud ${id}`);
    return s;
  }

  // El coordinador elige (o cambia) el docente mientras el docente no haya enviado el resultado
  async asignar(coordinador: Persona, id: number, d: { docenteId?: number; docente?: string }) {
    const s = await this.verCoordinacion(id);
    if (s.estado === 'REVISADA') throw new BadRequestException('El docente ya envió el resultado de esta homologación');
    const docenteId = Number(d?.docenteId);
    if (!Number.isInteger(docenteId) || docenteId <= 0 || !d?.docente?.trim()) throw new BadRequestException('Elige el docente');
    await this.prisma.solicitud.update({
      where: { id },
      data: { docenteId, docente: d.docente.trim(), coordinador: coordinador.nombre, asignada: new Date() },
    });
    return { id, docenteId, docente: d.docente.trim() };
  }

  // ---------- Docente ----------
  listarDelDocente(docente: Persona) {
    return this.prisma.solicitud.findMany({
      where: { docenteId: docente.id },
      include: { _count: { select: { materias: true } } },
      orderBy: { asignada: 'desc' },
    });
  }

  // Revisión del análisis: solo el docente asignado y cuando el agente ya respondió
  async verDelDocente(docente: Persona, id: number) {
    const s = await this.verCoordinacion(id);
    if (s.docenteId !== docente.id) throw new ForbiddenException('Esta solicitud no está asignada a ti');
    if (!CON_RESULTADO.includes(s.estado)) throw new BadRequestException('Esta solicitud todavía no tiene el resultado del agente');
    return s;
  }

  // El docente cambia el resultado de una materia (y de las que se evaluaron junto con ella), con su comentario
  async cambiar(docente: Persona, id: number, codigo: string, d: { resultado?: string; comentario?: string }) {
    const s = await this.verDelDocente(docente, id);
    if (s.estado === 'REVISADA') throw new BadRequestException('Ya enviaste el resultado al coordinador');
    if (!d?.resultado || !RESULTADOS.includes(d.resultado)) throw new BadRequestException(`El resultado debe ser: ${RESULTADOS.join(', ')}`);
    const comentario = (d.comentario ?? '').trim();
    if (comentario.length < 5) throw new BadRequestException('Explica en un comentario por qué cambias el resultado');
    const m = s.materias.find((x) => x.codigo === codigo);
    if (!m) throw new NotFoundException(`La materia ${codigo} no está en la solicitud`);
    const grupo = [codigo, ...(m.juntoCon ?? '').split(',').filter(Boolean)];
    const vuelveAlAgente = d.resultado === m.resultado; // si deja el resultado del agente, se quita el cambio
    await this.prisma.asignaturaAprobada.updateMany({
      where: { solicitudId: id, codigo: { in: grupo } },
      data: vuelveAlAgente
        ? { resultadoDocente: null, comentarioDocente: null, docenteCambio: null }
        : { resultadoDocente: d.resultado, comentarioDocente: comentario, docenteCambio: docente.nombre },
    });
    await this.actualizarRequisitos(id);
    return { codigo, resultado: d.resultado };
  }

  // El docente envía al coordinador lo homologable y lo no homologable: la solicitud queda REVISADA
  async terminar(docente: Persona, id: number, d: { comentario?: string }) {
    const s = await this.verDelDocente(docente, id);
    if (s.estado === 'REVISADA') throw new BadRequestException('Ya enviaste el resultado al coordinador');
    if (s.materias.some((m) => resultadoFinal(m) === 'Pendiente')) throw new BadRequestException('Hay materias pendientes: decide su resultado antes de enviarlo');
    await this.prisma.solicitud.update({
      where: { id },
      data: { estado: 'REVISADA', terminada: new Date(), comentarioFinal: d?.comentario?.trim() || null },
    });
    return { id, estado: 'REVISADA' };
  }

  // RN-08 se vuelve a revisar con los resultados finales (solo otra universidad)
  private async actualizarRequisitos(id: number) {
    const s = await this.prisma.solicitud.findUnique({ where: { id }, include: { materias: true } });
    if (s?.tipo !== 'EXTERNO') return;
    const requisitos = revisarRequisitos(s, s.materias.map((m) => ({ ...m, resultado: resultadoFinal(m) })));
    await this.prisma.solicitud.update({ where: { id }, data: { requisitos: JSON.stringify(requisitos) } });
  }
}

// El api-gateway ya filtra por rol; aquí se vuelve a revisar por si alguien llama directo
export function personaDe(rolEsperado: string, id?: string, rol?: string, nombre?: string, correo?: string): Persona {
  const n = Number(id);
  if (rol !== rolEsperado || !Number.isInteger(n) || n <= 0) throw new ForbiddenException('No tienes permiso para esto');
  return { id: n, nombre: nombre || correo || `Usuario ${n}` };
}
