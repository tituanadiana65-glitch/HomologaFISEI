import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../repository/prisma.service';
import { EventosService } from '../events/eventos.service';
import { type NuevaMateria, type NuevaSolicitud, validarMateria, validarSolicitud } from './validaciones';

// Resultado de una materia, tal como lo publica ms-agente-ia en solicitud.homologada
export interface ResultadoMateria {
  codigoAprobada: string;
  codigoNueva: string | null;
  resultado: string;
  informe: unknown;
}

@Injectable()
export class SolicitudesService implements OnModuleInit {
  private readonly log = new Logger(SolicitudesService.name);
  private readonly catalogo = process.env.MS_CATALOGO || 'http://localhost:3002';

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

  // T23 · Agrega una materia aprobada; el catálogo confirma que es de la carrera de origen
  async agregarMateria(usuarioId: number, id: number, m: NuevaMateria) {
    const s = await this.ver(usuarioId, id);
    if (s.estado !== 'BORRADOR') throw new BadRequestException('La solicitud ya fue enviada');
    const error = validarMateria(m, s.materias.map((x) => x.codigo));
    if (error) throw new BadRequestException(error);
    const r = await fetch(`${this.catalogo}/asignaturas/${encodeURIComponent(m.codigo)}`).catch(() => null);
    if (!r) throw new BadRequestException('El catálogo no responde, intenta en un momento');
    if (r.status === 404) throw new BadRequestException('La materia no está en el catálogo');
    if (!r.ok) throw new BadRequestException(`El catálogo respondió ${r.status}`);
    const a = (await r.json()) as { nombre: string; carrera?: { codigo: string } };
    if (a.carrera?.codigo !== s.carreraOrigen) throw new BadRequestException('La materia no es de tu carrera de origen');
    return this.prisma.asignaturaAprobada.create({
      data: {
        solicitudId: id,
        codigo: m.codigo,
        nombre: a.nombre,
        nivel: m.nivel,
        paralelo: m.paralelo,
        docente: m.docente,
        periodo: m.periodo,
        anio: m.anio,
        nota: m.nota,
        matricula: m.matricula,
      },
    });
  }

  // T23 · Quita una materia mientras la solicitud es borrador
  async quitarMateria(usuarioId: number, id: number, codigo: string) {
    const s = await this.ver(usuarioId, id);
    if (s.estado !== 'BORRADOR') throw new BadRequestException('La solicitud ya fue enviada');
    if (!s.materias.some((x) => x.codigo === codigo)) throw new NotFoundException('Esa materia no está en la solicitud');
    await this.prisma.asignaturaAprobada.delete({ where: { solicitudId_codigo: { solicitudId: id, codigo } } });
    return { quitada: codigo };
  }

  // T28 · Escucha los resultados del agente
  onModuleInit() {
    void this.eventos.escuchar('ms-solicitudes.resultados', 'solicitud.homologada', (d) => this.guardarResultado(d));
  }

  // T28 · Guarda el resultado de cada materia y actualiza el estado de la solicitud
  async guardarResultado(d: { solicitudId: number; resultados: ResultadoMateria[] }) {
    for (const r of d.resultados) {
      await this.prisma.asignaturaAprobada.update({
        where: { solicitudId_codigo: { solicitudId: d.solicitudId, codigo: r.codigoAprobada } },
        data: { resultado: r.resultado, codigoNueva: r.codigoNueva, informe: r.informe ? JSON.stringify(r.informe) : null },
      });
    }
    const materias = await this.prisma.asignaturaAprobada.findMany({ where: { solicitudId: d.solicitudId } });
    const listo = materias.every((m) => m.resultado && m.resultado !== 'Pendiente');
    await this.prisma.solicitud.update({ where: { id: d.solicitudId }, data: { estado: listo ? 'RESULTADO_LISTO' : 'ENVIADA' } });
    this.log.log(`Solicitud ${d.solicitudId}: ${d.resultados.length} resultados guardados${listo ? ', resultado listo' : ''}`);
  }

  // T28 · Vuelve a mandar al agente solo las materias Pendiente
  async reintentar(usuarioId: number, id: number) {
    const s = await this.ver(usuarioId, id);
    const pendientes = s.materias.filter((m) => m.resultado === 'Pendiente');
    if (pendientes.length === 0) throw new BadRequestException('No hay materias pendientes');
    await this.eventos.publicar('solicitud.enviada', {
      solicitudId: id,
      carreraDestino: s.carreraDestino,
      materias: pendientes.map((m) => ({ codigo: m.codigo, nota: m.nota, anio: m.anio })),
    });
    return { id, reintentadas: pendientes.length };
  }
}
