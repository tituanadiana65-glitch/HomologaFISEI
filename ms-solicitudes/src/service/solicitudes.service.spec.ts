import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';

// Base de datos y RabbitMQ simulados
function armar(solicitud?: object, abiertas = 0) {
  const prisma = {
    solicitud: {
      count: jest.fn().mockResolvedValue(abiertas),
      create: jest.fn().mockImplementation(({ data }) => ({ id: 1, estado: 'BORRADOR', ...data })),
      findUnique: jest.fn().mockResolvedValue(solicitud ?? null),
      update: jest.fn(),
    },
    asignaturaAprobada: {
      create: jest.fn().mockImplementation(({ data }) => ({ id: 10, ...data })),
      delete: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
  const eventos = { publicar: jest.fn().mockResolvedValue(true) };
  return { servicio: new SolicitudesService(prisma as any, eventos as any), prisma, eventos };
}

const datos = { carreraOrigen: 'TI', carreraDestino: 'SW', periodo: 'NOVIEMBRE 2026 - MARZO 2027' };
const fisica = { codigo: 'FIS-TI', nota: 8.5, anio: 2025 };

describe('SolicitudesService', () => {
  it('crea una solicitud en BORRADOR', async () => {
    const { servicio } = armar();
    await expect(servicio.crear(7, datos)).resolves.toMatchObject({ usuarioId: 7, estado: 'BORRADOR' });
  });

  it('guarda los datos de una solicitud de otra universidad (T37)', async () => {
    const { servicio, prisma } = armar(undefined, 0);
    await servicio.crear(7, {
      tipo: 'EXTERNO',
      universidadOrigen: ' Universidad Central del Ecuador ',
      carreraOrigen: 'Ingeniería Informática',
      carreraDestino: 'SW',
      periodo: 'NOVIEMBRE 2026 - MARZO 2027',
      periodosAprobados: 2,
      documentosLegalizados: true,
      mallaId: 3,
      recordId: 4,
    });
    expect(prisma.solicitud.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tipo: 'EXTERNO',
        universidadOrigen: 'Universidad Central del Ecuador',
        periodosAprobados: 2,
        documentosLegalizados: true,
        mallaId: 3,
        recordId: 4,
      }),
    });
  });

  it('una solicitud de la UTA no guarda datos de otra universidad', async () => {
    const { servicio, prisma } = armar(undefined, 0);
    await servicio.crear(7, { ...datos, universidadOrigen: 'X', mallaId: 3 } as never);
    expect(prisma.solicitud.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'INTERNO', universidadOrigen: null, mallaId: null }),
    });
  });

  it('no deja crear una segunda solicitud abierta', async () => {
    const { servicio } = armar(undefined, 1);
    await expect(servicio.crear(7, datos)).rejects.toThrow(BadRequestException);
  });

  it('no muestra la solicitud de otro estudiante', async () => {
    const { servicio } = armar({ id: 1, usuarioId: 99, estado: 'BORRADOR', materias: [] });
    await expect(servicio.ver(7, 1)).rejects.toThrow(ForbiddenException);
  });

  it('no envía una solicitud sin materias', async () => {
    const { servicio } = armar({ id: 1, usuarioId: 7, estado: 'BORRADOR', materias: [] });
    await expect(servicio.enviar(7, 1)).rejects.toThrow(/al menos una materia/);
  });

  it('al enviar publica solicitud.enviada con las materias', async () => {
    const { servicio, eventos } = armar({ id: 1, usuarioId: 7, estado: 'BORRADOR', carreraDestino: 'SW', materias: [fisica] });
    await expect(servicio.enviar(7, 1)).resolves.toEqual({ id: 1, estado: 'ENVIADA' });
    expect(eventos.publicar).toHaveBeenCalledWith('solicitud.enviada', {
      solicitudId: 1,
      carreraDestino: 'SW',
      materias: [{ codigo: 'FIS-TI', nota: 8.5, anio: 2025 }],
    });
  });
});

describe('SolicitudesService · materias (T23)', () => {
  const borrador = { id: 1, usuarioId: 7, estado: 'BORRADOR', carreraOrigen: 'TI', materias: [] };
  const materia = { codigo: 'FIS-TI', nivel: 'PRIMERO', paralelo: 'A', docente: 'Ing. Pérez', periodo: 'ABRIL 2025 - AGOSTO 2025', anio: 2025, nota: 8.5, matricula: 1 };
  const catalogo = (status: number, cuerpo: object) =>
    jest.spyOn(global, 'fetch').mockResolvedValue({ status, ok: status < 400, json: async () => cuerpo } as Response);

  afterEach(() => jest.restoreAllMocks());

  it('agrega una materia de la carrera de origen con el nombre del catálogo', async () => {
    catalogo(200, { nombre: 'FÍSICA', carrera: { codigo: 'TI' } });
    const { servicio } = armar(borrador);
    await expect(servicio.agregarMateria(7, 1, materia)).resolves.toMatchObject({ codigo: 'FIS-TI', nombre: 'FÍSICA', nota: 8.5 });
  });

  it('rechaza una materia de otra carrera', async () => {
    catalogo(200, { nombre: 'FÍSICA', carrera: { codigo: 'SW' } });
    const { servicio } = armar(borrador);
    await expect(servicio.agregarMateria(7, 1, materia)).rejects.toThrow(/carrera de origen/);
  });

  it('rechaza una materia que no está en el catálogo', async () => {
    catalogo(404, { message: 'No existe' });
    const { servicio } = armar(borrador);
    await expect(servicio.agregarMateria(7, 1, materia)).rejects.toThrow(/no está en el catálogo/);
  });

  it('no agrega materias a una solicitud enviada', async () => {
    const { servicio } = armar({ ...borrador, estado: 'ENVIADA' });
    await expect(servicio.agregarMateria(7, 1, materia)).rejects.toThrow(/ya fue enviada/);
  });

  it('quita una materia registrada', async () => {
    const { servicio, prisma } = armar({ ...borrador, materias: [{ codigo: 'FIS-TI' }] });
    await expect(servicio.quitarMateria(7, 1, 'FIS-TI')).resolves.toEqual({ quitada: 'FIS-TI' });
    expect(prisma.asignaturaAprobada.delete).toHaveBeenCalled();
  });
});

describe('SolicitudesService · resultado del agente (T28)', () => {
  const resultados = [
    { codigoAprobada: 'FIS-TI', codigoNueva: 'FIS-SW', resultado: 'Homologable', informe: { resultado: 'Homologable' } },
    { codigoAprobada: 'CAL-TI', codigoNueva: 'CAL-SW', resultado: 'No homologable', informe: { resultado: 'No homologable' } },
  ];

  it('guarda cada resultado y deja la solicitud en RESULTADO_LISTO', async () => {
    const { servicio, prisma } = armar();
    prisma.asignaturaAprobada.findMany.mockResolvedValue([{ resultado: 'Homologable' }, { resultado: 'No homologable' }]);
    await servicio.guardarResultado({ solicitudId: 1, resultados });
    expect(prisma.asignaturaAprobada.update).toHaveBeenCalledTimes(2);
    expect(prisma.asignaturaAprobada.update).toHaveBeenCalledWith({
      where: { solicitudId_codigo: { solicitudId: 1, codigo: 'FIS-TI' } },
      data: { resultado: 'Homologable', codigoNueva: 'FIS-SW', informe: JSON.stringify({ resultado: 'Homologable' }) },
    });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { estado: 'RESULTADO_LISTO' } });
  });

  it('con una materia Pendiente la solicitud sigue ENVIADA', async () => {
    const { servicio, prisma } = armar();
    prisma.asignaturaAprobada.findMany.mockResolvedValue([{ resultado: 'Homologable' }, { resultado: 'Pendiente' }]);
    await servicio.guardarResultado({ solicitudId: 1, resultados });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { estado: 'ENVIADA' } });
  });

  it('reintenta solo las materias Pendiente', async () => {
    const { servicio, eventos } = armar({
      id: 1, usuarioId: 7, estado: 'ENVIADA', carreraDestino: 'SW',
      materias: [{ codigo: 'FIS-TI', nota: 8.5, anio: 2025, resultado: 'Homologable' }, { codigo: 'CAL-TI', nota: 8, anio: 2025, resultado: 'Pendiente' }],
    });
    await expect(servicio.reintentar(7, 1)).resolves.toEqual({ id: 1, reintentadas: 1 });
    expect(eventos.publicar).toHaveBeenCalledWith('solicitud.enviada', {
      solicitudId: 1, carreraDestino: 'SW', materias: [{ codigo: 'CAL-TI', nota: 8, anio: 2025 }],
    });
  });

  it('no reintenta si no hay pendientes', async () => {
    const { servicio } = armar({ id: 1, usuarioId: 7, estado: 'RESULTADO_LISTO', materias: [{ codigo: 'FIS-TI', resultado: 'Homologable' }] });
    await expect(servicio.reintentar(7, 1)).rejects.toThrow(/No hay materias pendientes/);
  });
});
