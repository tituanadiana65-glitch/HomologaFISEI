import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../repository/prisma.service';
import { EventosService } from '../events/eventos.service';
import {
  type NuevaMateria,
  type NuevaMateriaExterna,
  type NuevaSolicitud,
  validarMateria,
  revisarRequisitos,
  validarMateriaExterna,
  validarSolicitud,
} from './validaciones';
import { codigoExterno, convertirNota } from './notas';

// Datos mínimos de una materia guardada que van en el mensaje al agente
interface MateriaGuardada {
  codigo: string;
  nombre: string;
  nota: number;
  anio: number;
  creditos?: number | null;
  horas?: number | null;
  notaOriginal?: number | null;
  escala?: number | null;
  silaboId?: number | null;
}

// Mensaje solicitud.enviada. INTERNO: igual que en el Sprint 2. EXTERNO: lleva tipo y los datos de cada materia (T38).
export function mensajeEnviada(s: { tipo?: string; carreraDestino: string }, solicitudId: number, materias: MateriaGuardada[]) {
  if (s.tipo !== 'EXTERNO') {
    return { solicitudId, carreraDestino: s.carreraDestino, materias: materias.map((m) => ({ codigo: m.codigo, nota: m.nota, anio: m.anio })) };
  }
  return {
    solicitudId,
    tipo: 'EXTERNO',
    carreraDestino: s.carreraDestino,
    materias: materias.map((m) => ({
      codigo: m.codigo,
      nombre: m.nombre,
      creditos: m.creditos,
      horas: m.horas,
      nota: m.nota,
      notaOriginal: m.notaOriginal,
      escala: m.escala,
      anio: m.anio,
      silaboId: m.silaboId ?? null,
    })),
  };
}

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

  // T20 · Crea la solicitud si el estudiante no tiene otra abierta (T37: también de otra universidad)
  async crear(usuarioId: number, d: NuevaSolicitud) {
    const abiertas = await this.prisma.solicitud.count({ where: { usuarioId, estado: { not: 'RESULTADO_LISTO' } } });
    const error = validarSolicitud(d, abiertas);
    if (error) throw new BadRequestException(error);
    const externa = d.tipo === 'EXTERNO';
    return this.prisma.solicitud.create({
      data: {
        usuarioId,
        tipo: externa ? 'EXTERNO' : 'INTERNO',
        carreraOrigen: d.carreraOrigen.trim(),
        carreraDestino: d.carreraDestino,
        periodo: d.periodo,
        // T37 · Datos de otra universidad (en una solicitud de la UTA quedan vacíos)
        universidadOrigen: externa ? d.universidadOrigen!.trim() : null,
        periodosAprobados: externa ? d.periodosAprobados! : null,
        documentosLegalizados: externa && d.documentosLegalizados === true,
        mallaId: externa ? (d.mallaId ?? null) : null,
        recordId: externa ? (d.recordId ?? null) : null,
      },
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
    await this.eventos.publicar('solicitud.enviada', mensajeEnviada(s, id, s.materias));
    return { id, estado: 'ENVIADA' };
  }

  // T23 · Agrega una materia aprobada; el catálogo confirma que es de la carrera de origen
  async agregarMateria(usuarioId: number, id: number, m: NuevaMateria) {
    const s = await this.ver(usuarioId, id);
    if (s.estado !== 'BORRADOR') throw new BadRequestException('La solicitud ya fue enviada');
    if (s.tipo === 'EXTERNO') throw new BadRequestException('Tu solicitud es de otra universidad: registra la materia con su nombre, créditos y horas');
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

  // T38 + T41 · Agrega una materia de otra universidad; guarda la nota original y la convertida a la escala sobre 10
  async agregarMateriaExterna(usuarioId: number, id: number, m: NuevaMateriaExterna) {
    const s = await this.ver(usuarioId, id);
    if (s.estado !== 'BORRADOR') throw new BadRequestException('La solicitud ya fue enviada');
    if (s.tipo !== 'EXTERNO') throw new BadRequestException('Esta solicitud es de la UTA: elige la materia del catálogo');
    const error = validarMateriaExterna(m, s.materias.map((x) => x.codigo));
    if (error) throw new BadRequestException(error);
    return this.prisma.asignaturaAprobada.create({
      data: {
        solicitudId: id,
        codigo: codigoExterno(m.nombre),
        nombre: m.nombre.trim(),
        nivel: '-',
        paralelo: '-',
        docente: '-',
        periodo: '-',
        anio: m.anio,
        nota: convertirNota(m.nota, m.escala),
        notaOriginal: m.nota,
        escala: m.escala,
        matricula: 1,
        creditos: m.creditos,
        horas: m.horas,
        silaboId: m.silaboId ?? null,
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
    const estado = listo ? 'RESULTADO_LISTO' : 'ENVIADA';
    // T45 · Con todo evaluado, una solicitud de otra universidad guarda también su revisión de RN-08
    const s = listo ? await this.prisma.solicitud.findUnique({ where: { id: d.solicitudId } }) : null;
    if (s?.tipo === 'EXTERNO') {
      const requisitos = revisarRequisitos(s, materias);
      await this.prisma.solicitud.update({ where: { id: d.solicitudId }, data: { estado, requisitos: JSON.stringify(requisitos) } });
    } else {
      await this.prisma.solicitud.update({ where: { id: d.solicitudId }, data: { estado } });
    }
    this.log.log(`Solicitud ${d.solicitudId}: ${d.resultados.length} resultados guardados${listo ? ', resultado listo' : ''}`);
  }

  // T28 · Vuelve a mandar al agente solo las materias Pendiente
  async reintentar(usuarioId: number, id: number) {
    const s = await this.ver(usuarioId, id);
    const pendientes = s.materias.filter((m) => m.resultado === 'Pendiente');
    if (pendientes.length === 0) throw new BadRequestException('No hay materias pendientes');
    await this.eventos.publicar('solicitud.enviada', mensajeEnviada(s, id, pendientes));
    return { id, reintentadas: pendientes.length };
  }
}
