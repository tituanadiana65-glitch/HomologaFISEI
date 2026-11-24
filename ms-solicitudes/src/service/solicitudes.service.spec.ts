import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';

// Base de datos y RabbitMQ simulados
function armar(solicitud?: object, abiertas = 0) {
  const prisma = {
    solicitud: {
      count: jest.fn().mockResolvedValue(abiertas),
      create: jest.fn().mockImplementation(({ data }) => ({ id: 1, estado: 'BORRADOR', ...data })),
      findUnique: jest.fn().mockResolvedValue(solicitud ?? null),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn(),
    },
    asignaturaAprobada: {
      create: jest.fn().mockImplementation(({ data }) => ({ id: 10, ...data })),
      delete: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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
    const { servicio, eventos, prisma } = armar({ id: 1, usuarioId: 7, estado: 'BORRADOR', carreraDestino: 'SW', materias: [fisica] });
    await expect(servicio.enviar(7, 1)).resolves.toEqual({ id: 1, estado: 'ENVIADA' });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { estado: 'ENVIADA', enviada: expect.any(Date) } });
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
      data: { resultado: 'Homologable', codigoNueva: 'FIS-SW', informe: JSON.stringify({ resultado: 'Homologable' }), juntoCon: null },
    });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { estado: 'RESULTADO_LISTO' } });
  });

  it('con una materia Pendiente la solicitud sigue ENVIADA', async () => {
    const { servicio, prisma } = armar();
    prisma.asignaturaAprobada.findMany.mockResolvedValue([{ resultado: 'Homologable' }, { resultado: 'Pendiente' }]);
    await servicio.guardarResultado({ solicitudId: 1, resultados });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { estado: 'ENVIADA' } });
  });

  it('una solicitud de otra universidad guarda la revisión de RN-08 al terminar (T45)', async () => {
    const { servicio, prisma } = armar({ id: 1, tipo: 'EXTERNO', periodosAprobados: 1, documentosLegalizados: true });
    prisma.asignaturaAprobada.findMany.mockResolvedValue([{ resultado: 'Homologable' }, { resultado: 'Homologable' }]);
    await servicio.guardarResultado({ solicitudId: 1, resultados });
    const llamada = prisma.solicitud.update.mock.calls[0][0];
    expect(llamada.data.estado).toBe('RESULTADO_LISTO');
    const requisitos = JSON.parse(llamada.data.requisitos);
    expect(requisitos.cumple).toBe(false);
    expect(requisitos.causas[0].causa).toBe('Tiene 1 periodo aprobado (mínimo 2)');
  });

  it('con materias Pendiente todavía no revisa RN-08', async () => {
    const { servicio, prisma } = armar({ id: 1, tipo: 'EXTERNO', periodosAprobados: 2, documentosLegalizados: true });
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

  it('al reintentar marca las pendientes como en revisión', async () => {
    const { servicio, prisma } = armar({
      id: 1, usuarioId: 7, estado: 'ENVIADA', carreraDestino: 'SW',
      materias: [{ codigo: 'CAL-TI', nota: 8, anio: 2025, resultado: 'Pendiente' }],
    });
    await servicio.reintentar(7, 1);
    expect(prisma.asignaturaAprobada.updateMany).toHaveBeenCalledWith({
      where: { solicitudId: 1, codigo: { in: ['CAL-TI'] }, resultado: 'Pendiente' },
      data: { resultado: null },
    });
  });

  it('no lanza una segunda revisión si otro clic ya tomó las pendientes', async () => {
    const { servicio, prisma, eventos } = armar({
      id: 1, usuarioId: 7, estado: 'ENVIADA', carreraDestino: 'SW',
      materias: [{ codigo: 'CAL-TI', nota: 8, anio: 2025, resultado: 'Pendiente' }],
    });
    prisma.asignaturaAprobada.updateMany.mockResolvedValue({ count: 0 });
    await expect(servicio.reintentar(7, 1)).rejects.toThrow(/ya las está revisando/);
    expect(eventos.publicar).not.toHaveBeenCalled();
  });

  it('no reintenta si no hay pendientes', async () => {
    const { servicio } = armar({ id: 1, usuarioId: 7, estado: 'RESULTADO_LISTO', materias: [{ codigo: 'FIS-TI', resultado: 'Homologable' }] });
    await expect(servicio.reintentar(7, 1)).rejects.toThrow(/No hay materias pendientes/);
  });
});

// T38 + T41 · Materias de otra universidad
describe('SolicitudesService · otra universidad (T38)', () => {
  const externa = { id: 2, usuarioId: 7, estado: 'BORRADOR', tipo: 'EXTERNO', carreraDestino: 'SW', materias: [] as object[] };
  const calculo = { nombre: 'Cálculo II', creditos: 4, horas: 160, nota: 16, escala: 20, anio: 2025, silaboId: 7 };

  it('guarda la materia con la nota convertida y la original', async () => {
    const { servicio, prisma } = armar(externa);
    await servicio.agregarMateriaExterna(7, 2, calculo);
    expect(prisma.asignaturaAprobada.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        codigo: 'EXT-CALCULO-II', nombre: 'Cálculo II', nota: 8, notaOriginal: 16, escala: 20,
        creditos: 4, horas: 160, silaboId: 7, nivel: '-', paralelo: '-', docente: '-',
      }),
    });
  });

  it('rechaza una materia externa en una solicitud de la UTA', async () => {
    const { servicio } = armar({ ...externa, tipo: 'INTERNO' });
    await expect(servicio.agregarMateriaExterna(7, 2, calculo)).rejects.toThrow(/es de la UTA/);
  });

  it('rechaza una materia del catálogo en una solicitud de otra universidad', async () => {
    const { servicio } = armar(externa);
    await expect(servicio.agregarMateria(7, 2, { codigo: 'FIS-TI' } as never)).rejects.toThrow(/otra universidad/);
  });

  it('explica por qué rechaza datos inválidos', async () => {
    const { servicio } = armar(externa);
    await expect(servicio.agregarMateriaExterna(7, 2, { ...calculo, nota: 25 })).rejects.toThrow(/entre 0 y 20/);
  });

  it('al enviar publica el tipo y los datos de cada materia', async () => {
    const guardada = { codigo: 'EXT-CALCULO-II', nombre: 'Cálculo II', creditos: 4, horas: 160, nota: 8, notaOriginal: 16, escala: 20, anio: 2025, silaboId: 7 };
    const { servicio, eventos } = armar({ ...externa, mallaId: 3, recordId: 4, materias: [guardada] });
    await servicio.enviar(7, 2);
    expect(eventos.publicar).toHaveBeenCalledWith('solicitud.enviada', {
      solicitudId: 2, tipo: 'EXTERNO', carreraDestino: 'SW', materias: [guardada],
    });
  });
});

// HU-26 · se guardan las materias evaluadas juntas
describe('SolicitudesService · materias juntas', () => {
  it('guarda juntoCon', async () => {
    const { servicio, prisma } = armar();
    prisma.solicitud.findUnique.mockResolvedValue({ id: 3, tipo: 'INTERNO' });
    await servicio.guardarResultado({
      solicitudId: 3,
      resultados: [{ codigoAprobada: 'A', codigoNueva: 'SW-F', resultado: 'Homologable', informe: null, juntoCon: ['B', 'C'] }],
    });
    expect(prisma.asignaturaAprobada.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ juntoCon: 'B,C' }) }));
  });
});

// Revisión docente: la solicitud guarda el nombre del estudiante y una ya revisada no cuenta como abierta
describe('SolicitudesService · nombre del estudiante', () => {
  it('guarda el nombre y no cuenta como abiertas las REVISADAS', async () => {
    const { servicio, prisma } = armar();
    await servicio.crear(7, { carreraOrigen: 'TI', carreraDestino: 'SW', periodo: 'NOVIEMBRE 2026 - MARZO 2027' }, 'Ana Tituaña');
    expect(prisma.solicitud.count).toHaveBeenCalledWith({ where: { usuarioId: 7, estado: { notIn: ['RESULTADO_LISTO', 'REVISADA'] } } });
    expect(prisma.solicitud.create).toHaveBeenCalledWith({ data: expect.objectContaining({ estudiante: 'Ana Tituaña' }) });
  });
});

// Coordinador y docente (23/11/2026): el coordinador registra la solicitud y el docente asignado la trabaja
describe('SolicitudesService · coordinador y docente', () => {
  const coord = { id: 5, nombre: 'Ing. Coordinadora' };
  const base = { carreraOrigen: 'TI', carreraDestino: 'SW', periodo: 'NOVIEMBRE 2026 - MARZO 2027' };

  it('el coordinador registra la solicitud con el nombre del estudiante y el docente', async () => {
    const { servicio, prisma } = armar();
    await servicio.crearPorCoordinador(coord, { ...base, estudiante: ' Ana Pérez ', documento: '1801 234566', docenteId: 11, docente: 'Ing. Luis' });
    expect(prisma.solicitud.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ usuarioId: 5, estudiante: 'Ana Pérez', documento: '1801234566', tipoDocumento: 'CEDULA', docenteId: 11, docente: 'Ing. Luis', coordinador: 'Ing. Coordinadora', asignada: expect.any(Date) }),
    });
    expect(prisma.solicitud.count).not.toHaveBeenCalled(); // el coordinador registra muchas
  });

  it('pide el nombre del estudiante y valida los datos; sin docente queda por asignar', async () => {
    const { servicio, prisma } = armar();
    await expect(servicio.crearPorCoordinador(coord, { ...base, estudiante: '' })).rejects.toThrow('nombre del estudiante');
    await expect(servicio.crearPorCoordinador(coord, { ...base, tipo: 'EXTERNO', estudiante: 'Ana', documento: '1801234566' })).rejects.toThrow('viene el estudiante');
    await servicio.crearPorCoordinador(coord, { ...base, tipo: 'EXTERNO', universidadOrigen: 'UCE', periodosAprobados: 2, estudiante: 'Ana', tipoDocumento: 'PASAPORTE', documento: 'ab123456' });
    expect(prisma.solicitud.create.mock.calls[0][0].data).not.toHaveProperty('docenteId');
    expect(prisma.solicitud.create.mock.calls[0][0].data).not.toHaveProperty('mallaId'); // la malla la sube el docente
  });

  it('pide la cédula o el pasaporte y no deja dos solicitudes en trámite del mismo estudiante', async () => {
    const { servicio, prisma } = armar();
    await expect(servicio.crearPorCoordinador(coord, { ...base, estudiante: 'Juanito Pérez' })).rejects.toThrow('cédula');
    await expect(servicio.crearPorCoordinador(coord, { ...base, estudiante: 'Juanito Pérez', documento: '18012345' })).rejects.toThrow('10 números');
    prisma.solicitud.findFirst.mockResolvedValueOnce({ id: 42, estudiante: 'Juanito Pérez' });
    await expect(servicio.crearPorCoordinador(coord, { ...base, estudiante: 'Juanito Pérez', documento: '1801234566' })).rejects.toThrow('N.º 42');
    // otro Juanito Pérez con otra cédula sí se registra
    await servicio.crearPorCoordinador(coord, { ...base, estudiante: 'Juanito Pérez', documento: '1700000019' });
    expect(prisma.solicitud.create.mock.calls[0][0].data).toEqual(expect.objectContaining({ documento: '1700000019', tipoDocumento: 'CEDULA' }));
  });

  it('el docente asignado trabaja la solicitud; otro docente no; el coordinador solo la ve', async () => {
    const s = { id: 1, usuarioId: 5, docenteId: 11, estado: 'BORRADOR', tipo: 'INTERNO', carreraOrigen: 'TI', materias: [] };
    await expect(armar(s).servicio.ver({ id: 11, rol: 'DOCENTE' }, 1, true)).resolves.toEqual(expect.objectContaining({ id: 1 }));
    await expect(armar(s).servicio.ver({ id: 12, rol: 'DOCENTE' }, 1)).rejects.toThrow('no está asignada a ti');
    await expect(armar(s).servicio.ver({ id: 6, rol: 'COORDINADOR' }, 1)).resolves.toEqual(expect.objectContaining({ id: 1 }));
    await expect(armar(s).servicio.quitarMateria({ id: 6, rol: 'COORDINADOR' }, 1, 'X')).rejects.toThrow('no es tuya');
  });

  it('el docente sube el expediente: malla, récord, periodos y legalización', async () => {
    const s = { id: 1, usuarioId: 5, docenteId: 11, estado: 'BORRADOR', tipo: 'EXTERNO', materias: [] };
    const { servicio, prisma } = armar(s);
    await servicio.expediente({ id: 11, rol: 'DOCENTE' }, 1, { mallaId: 7, recordId: 8, periodosAprobados: 3, documentosLegalizados: true });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { mallaId: 7, recordId: 8, periodosAprobados: 3, documentosLegalizados: true } });
    await expect(servicio.expediente({ id: 11, rol: 'DOCENTE' }, 1, { mallaId: -1 })).rejects.toThrow('no es válido');
    await expect(armar({ ...s, estado: 'ENVIADA' }).servicio.expediente({ id: 11, rol: 'DOCENTE' }, 1, { recordId: 8 })).rejects.toThrow('ya fue enviada');
  });

  it('una solicitud de otra universidad no se envía sin malla ni récord', async () => {
    const s = { id: 1, usuarioId: 5, docenteId: 11, estado: 'BORRADOR', tipo: 'EXTERNO', carreraDestino: 'SW', mallaId: null, recordId: null, materias: [{ codigo: 'EXT-A' }] };
    await expect(armar(s).servicio.enviar({ id: 11, rol: 'DOCENTE' }, 1)).rejects.toThrow('Sube la malla y el récord');
  });
});

