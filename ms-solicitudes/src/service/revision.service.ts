import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../repository/prisma.service';
import { revisarRequisitos } from './validaciones';

// Revisión docente (observación del 22/11/2026: "dos docentes trabajan en un mismo informe").
// El agente hace el análisis; luego dos docentes distintos lo revisan. Un docente puede cambiar el resultado
// de una materia con su comentario. Con dos aprobaciones el informe queda REVISADO.
export const RESULTADOS = ['Homologable', 'No homologable', 'Sin materia equivalente'];
export const APROBACIONES_NECESARIAS = 2;

export interface Docente {
  id: number;
  nombre: string;
}

// Resultado que vale: el del docente si lo cambió; si no, el del agente
export const resultadoFinal = (m: { resultado?: string | null; resultadoDocente?: string | null }) => m.resultadoDocente ?? m.resultado ?? null;

@Injectable()
export class RevisionService {
  constructor(private readonly prisma: PrismaService) {}

  // Informes con resultado del agente, para revisar
  listar() {
    return this.prisma.solicitud.findMany({
      where: { estado: { in: ['RESULTADO_LISTO', 'REVISADA'] } },
      include: { revisiones: { orderBy: { fecha: 'asc' } }, _count: { select: { materias: true } } },
      orderBy: { id: 'desc' },
    });
  }

  async ver(id: number) {
    const s = await this.prisma.solicitud.findUnique({ where: { id }, include: { materias: true, revisiones: { orderBy: { fecha: 'asc' } } } });
    if (!s) throw new NotFoundException(`No existe la solicitud ${id}`);
    if (!['RESULTADO_LISTO', 'REVISADA'].includes(s.estado)) throw new BadRequestException('Esta solicitud todavía no tiene el resultado del agente');
    return s;
  }

  // El docente cambia el resultado de una materia (y de las que se evaluaron junto con ella). Las aprobaciones anteriores
  // se borran: los docentes deben aprobar el informe tal como quedó.
  async cambiar(docente: Docente, id: number, codigo: string, d: { resultado?: string; comentario?: string }) {
    const s = await this.ver(id);
    if (s.estado === 'REVISADA') throw new BadRequestException('Este informe ya fue aprobado por dos docentes');
    if (!d?.resultado || !RESULTADOS.includes(d.resultado)) throw new BadRequestException(`El resultado debe ser: ${RESULTADOS.join(', ')}`);
    const comentario = (d.comentario ?? '').trim();
    if (comentario.length < 5) throw new BadRequestException('Explica en un comentario por qué cambias el resultado');
    const m = s.materias.find((x) => x.codigo === codigo);
    if (!m) throw new NotFoundException(`La materia ${codigo} no está en la solicitud`);
    const grupo = [codigo, ...(m.juntoCon ?? '').split(',').filter(Boolean)];
    const vuelveAlAgente = d.resultado === m.resultado; // si deja el mismo resultado del agente, se quita el cambio
    await this.prisma.asignaturaAprobada.updateMany({
      where: { solicitudId: id, codigo: { in: grupo } },
      data: vuelveAlAgente
        ? { resultadoDocente: null, comentarioDocente: null, docenteCambio: null }
        : { resultadoDocente: d.resultado, comentarioDocente: comentario, docenteCambio: docente.nombre },
    });
    const borradas = await this.prisma.revision.deleteMany({ where: { solicitudId: id } });
    await this.actualizarRequisitos(id);
    return { codigo, resultado: d.resultado, aprobacionesBorradas: borradas.count };
  }

  // El docente aprueba el informe. Con dos docentes distintos queda REVISADO.
  async aprobar(docente: Docente, id: number, d: { comentario?: string }) {
    const s = await this.ver(id);
    if (s.estado === 'REVISADA') throw new BadRequestException('Este informe ya fue aprobado por dos docentes');
    if (s.materias.some((m) => resultadoFinal(m) === 'Pendiente')) {
      throw new BadRequestException('Hay materias pendientes: decide su resultado antes de aprobar');
    }
    if (s.revisiones.some((r) => r.docenteId === docente.id)) throw new BadRequestException('Ya aprobaste este informe; falta el otro docente');
    await this.prisma.revision.create({
      data: { solicitudId: id, docenteId: docente.id, docente: docente.nombre, comentario: d?.comentario?.trim() || null },
    });
    const aprobaciones = s.revisiones.length + 1;
    const revisada = aprobaciones >= APROBACIONES_NECESARIAS;
    if (revisada) await this.prisma.solicitud.update({ where: { id }, data: { estado: 'REVISADA' } });
    return { id, aprobaciones, revisada };
  }

  // RN-08 se vuelve a revisar con los resultados finales (solo otra universidad)
  private async actualizarRequisitos(id: number) {
    const s = await this.prisma.solicitud.findUnique({ where: { id }, include: { materias: true } });
    if (s?.tipo !== 'EXTERNO') return;
    const requisitos = revisarRequisitos(s, s.materias.map((m) => ({ ...m, resultado: resultadoFinal(m) })));
    await this.prisma.solicitud.update({ where: { id }, data: { requisitos: JSON.stringify(requisitos) } });
  }
}

// El api-gateway solo deja pasar a los docentes; aquí se vuelve a revisar por si alguien llama directo
export function docenteDe(id?: string, rol?: string, nombre?: string, correo?: string): Docente {
  const n = Number(id);
  if (rol !== 'DOCENTE' || !Number.isInteger(n) || n <= 0) throw new ForbiddenException('Solo los docentes pueden revisar informes');
  return { id: n, nombre: nombre || correo || `Docente ${n}` };
}
