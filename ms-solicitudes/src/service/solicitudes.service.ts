import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../repository/prisma.service';
import { EventosService } from '../events/eventos.service';
import { type NuevaSolicitud, validarSolicitud } from './validaciones';

@Injectable()
export class SolicitudesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
  ) {}

  // T20 · Crea la solicitud si el estudiante no tiene otra abierta
  async crear(usuarioId: number, d: NuevaSolicitud) {
    const abiertas = await this.prisma.solicitud.count({ where: { usuarioId, estado: { not: 'RESULTADO_LISTO' } } });
    const error = validarSolicitud(d, abiertas);
    if (error) throw new BadRequestException(error);
    return this.prisma.solicitud.create({
      data: { usuarioId, carreraOrigen: d.carreraOrigen, carreraDestino: d.carreraDestino, periodo: d.periodo },
    });
  }

  // T20 · La solicitud más reciente del estudiante, con sus materias
  mia(usuarioId: number) {
    return this.prisma.solicitud.findFirst({
      where: { usuarioId },
      orderBy: { creada: 'desc' },
      include: { materias: true },
    });
  }

  // T20 · Una solicitud; solo la ve su dueño
  async ver(usuarioId: number, id: number) {
    const s = await this.prisma.solicitud.findUnique({ where: { id }, include: { materias: true } });
    if (!s) throw new NotFoundException(`No existe la solicitud ${id}`);
    if (s.usuarioId !== usuarioId) throw new ForbiddenException('Esta solicitud no es tuya');
    return s;
  }

  // T22 · Envía la solicitud al agente (evento solicitud.enviada)
  async enviar(usuarioId: number, id: number) {
    const s = await this.ver(usuarioId, id);
    if (s.estado !== 'BORRADOR') throw new BadRequestException('La solicitud ya fue enviada');
    if (s.materias.length === 0) throw new BadRequestException('Registra al menos una materia antes de enviar');
    await this.prisma.solicitud.update({ where: { id }, data: { estado: 'ENVIADA' } });
    await this.eventos.publicar('solicitud.enviada', {
      solicitudId: id,
      carreraDestino: s.carreraDestino,
      materias: s.materias.map((m) => ({ codigo: m.codigo, nota: m.nota, anio: m.anio })),
    });
    return { id, estado: 'ENVIADA' };
  }
}
