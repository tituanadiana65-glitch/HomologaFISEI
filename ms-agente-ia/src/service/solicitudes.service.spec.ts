import { SolicitudesAgenteService } from './solicitudes.service';
import type { EventosService } from '../events/eventos.service';
import type { ClientesService } from './clientes.service';
import type { HomologacionService } from './homologacion.service';
import type { AgenteService } from './agente.service';

describe('SolicitudesAgenteService', () => {
  it('homologa Física y marca Fundamentos de Programación como sin equivalente', async () => {
    process.env.IA_PAUSA_MS = '0';
    const nombres: Record<string, string> = { 'TI-FIS': 'Física', 'TI-FP': 'Fundamentos de Programación' };
    const clientes = {
      asignaturas: jest.fn().mockResolvedValue([{ codigo: 'SW-FIS', nombre: 'FÍSICA' }]),
      materia: jest.fn((c: string) => Promise.resolve({ codigo: c, nombre: nombres[c] })),
    };
    const homologacion = { homologar: jest.fn().mockResolvedValue({ resultado: 'Homologable' }) };
    const publicar = jest.fn().mockResolvedValue(true);
    const s = new SolicitudesAgenteService(
      { publicar, escuchar: jest.fn() } as unknown as EventosService,
      clientes as unknown as ClientesService,
      homologacion as unknown as HomologacionService,
      {} as unknown as AgenteService,
    );

    await s.homologarSolicitud({
      solicitudId: 7,
      carreraDestino: 'SW',
      materias: [
        { codigo: 'TI-FIS', nota: 8, anio: 2025 },
        { codigo: 'TI-FP', nota: 9, anio: 2025 },
      ],
    });

    expect(homologacion.homologar).toHaveBeenCalledWith({ codigoAprobada: 'TI-FIS', codigoNueva: 'SW-FIS', nota: 8, anio: 2025 });
    expect(publicar).toHaveBeenCalledWith('solicitud.homologada', {
      solicitudId: 7,
      resultados: [
        expect.objectContaining({ resultado: 'Homologable', codigoNueva: 'SW-FIS' }),
        expect.objectContaining({ resultado: 'Sin materia equivalente', codigoNueva: null }),
      ],
    });
  });

  it('si una materia falla, queda Pendiente y las demás siguen', async () => {
    process.env.IA_PAUSA_MS = '0';
    const clientes = {
      asignaturas: jest.fn().mockResolvedValue([]),
      materia: jest.fn().mockRejectedValue(new Error('ms-catalogo no responde')),
    };
    const publicar = jest.fn().mockResolvedValue(true);
    const s = new SolicitudesAgenteService(
      { publicar, escuchar: jest.fn() } as unknown as EventosService,
      clientes as unknown as ClientesService,
      {} as unknown as HomologacionService,
      {} as unknown as AgenteService,
    );
    await s.homologarSolicitud({ solicitudId: 8, carreraDestino: 'SW', materias: [{ codigo: 'X', nota: 8, anio: 2025 }] });
    expect(publicar).toHaveBeenCalledWith('solicitud.homologada', { solicitudId: 8, resultados: [expect.objectContaining({ resultado: 'Pendiente' })] });
  });

  // ---------- T43 · materia de otra universidad ----------
  describe('EXTERNO (T43)', () => {
    const destino = [
      { codigo: 'SW-CI', nombre: 'CÁLCULO INTEGRAL' },
      { codigo: 'SW-FIS', nombre: 'FÍSICA' },
    ];
    const armar = (agente: object, clientesExtra: object = {}, homologacion: object = {}) => {
      process.env.IA_PAUSA_MS = '0';
      const clientes = {
        asignaturas: jest.fn().mockResolvedValue(destino),
        candidatas: jest.fn().mockResolvedValue(destino.map((d) => ({ ...d, unidades: [] }))),
        textoSilabo: jest.fn().mockResolvedValue('Integrales dobles y triples'),
        ...clientesExtra,
      };
      const publicar = jest.fn().mockResolvedValue(true);
      const s = new SolicitudesAgenteService(
        { publicar, escuchar: jest.fn() } as unknown as EventosService,
        clientes as unknown as ClientesService,
        homologacion as unknown as HomologacionService,
        agente as unknown as AgenteService,
      );
      return { s, clientes, publicar };
    };
    const calculoII = { codigo: 'EXT-CALCULO-II', nombre: 'Cálculo II', creditos: 4, horas: 160, nota: 8, notaOriginal: 16, escala: 20, anio: 2025, silaboId: 7 as number | undefined };
    const enviar = (s: SolicitudesAgenteService, materias = [calculoII]) =>
      s.homologarSolicitud({ solicitudId: 12, tipo: 'EXTERNO', carreraDestino: 'SW', materias });

    it('si el nombre es igual no gasta IA', async () => {
      const agente = { elegirParecida: jest.fn() };
      const { s } = armar(agente);
      expect(await s.buscarMateriaParecida({ ...calculoII, nombre: 'Física' }, 'silabo', destino, () => Promise.resolve([]))).toEqual({ codigo: 'SW-FIS', parecido: 100 });
      expect(agente.elegirParecida).not.toHaveBeenCalled();
    });

    it('Cálculo II (sílabo de otra universidad) encuentra CÁLCULO INTEGRAL y se evalúa con sus datos', async () => {
      const agente = { elegirParecida: jest.fn().mockResolvedValue({ codigo: 'SW-CI', parecido: 82 }) };
      const informe = { resultado: 'Homologable' };
      const homologacion = { homologarExterna: jest.fn().mockResolvedValue(informe) };
      const { s, clientes, publicar } = armar(agente, {}, homologacion);
      await enviar(s);
      expect(homologacion.homologarExterna).toHaveBeenCalledWith({
        codigoAprobada: 'EXT-CALCULO-II', nombre: 'Cálculo II', silabo: 'Integrales dobles y triples',
        codigoNueva: 'SW-CI', creditos: 4, horas: 160, nota: 8, anio: 2025,
        parecido: 82, notaOriginal: 16, escala: 20,
      });
      expect(clientes.textoSilabo).toHaveBeenCalledWith(7);
      expect(agente.elegirParecida).toHaveBeenCalledWith('Integrales dobles y triples', expect.any(Array));
      expect(publicar).toHaveBeenCalledWith('solicitud.homologada', {
        solicitudId: 12,
        resultados: [{ codigoAprobada: 'EXT-CALCULO-II', codigoNueva: 'SW-CI', resultado: 'Homologable', informe }],
      });
    });

    it('si el nombre es igual, evalúa sin pedir a la IA que elija', async () => {
      const agente = { elegirParecida: jest.fn() };
      const homologacion = { homologarExterna: jest.fn().mockResolvedValue({ resultado: 'No homologable' }) };
      const { s, publicar } = armar(agente, {}, homologacion);
      await enviar(s, [{ ...calculoII, nombre: 'Cálculo Integral' }]);
      expect(agente.elegirParecida).not.toHaveBeenCalled();
      expect(homologacion.homologarExterna).toHaveBeenCalledWith(expect.objectContaining({ codigoNueva: 'SW-CI' }));
      expect(publicar).toHaveBeenCalledWith('solicitud.homologada', { solicitudId: 12, resultados: [expect.objectContaining({ resultado: 'No homologable' })] });
    });

    it('si falla la evaluación (por ejemplo sin horas) queda Pendiente', async () => {
      const homologacion = { homologarExterna: jest.fn().mockRejectedValue(new Error('necesita créditos y horas')) };
      const { s, publicar } = armar({ elegirParecida: jest.fn().mockResolvedValue({ codigo: 'SW-CI', parecido: 90 }) }, {}, homologacion);
      await enviar(s);
      expect(publicar).toHaveBeenCalledWith('solicitud.homologada', { solicitudId: 12, resultados: [expect.objectContaining({ resultado: 'Pendiente' })] });
    });

    it('si ninguna se parece (menos de 50) queda Sin materia equivalente', async () => {
      const { s, publicar } = armar({ elegirParecida: jest.fn().mockResolvedValue(null) });
      await enviar(s);
      expect(publicar).toHaveBeenCalledWith('solicitud.homologada', {
        solicitudId: 12,
        resultados: [expect.objectContaining({ resultado: 'Sin materia equivalente', codigoNueva: null })],
      });
    });

    it('si falla la IA queda Pendiente y la otra materia sigue', async () => {
      const agente = { elegirParecida: jest.fn().mockRejectedValueOnce(new Error('límite gratuito')).mockResolvedValueOnce(null) };
      const { s, publicar } = armar(agente);
      await enviar(s, [calculoII, { ...calculoII, codigo: 'EXT-OTRA', nombre: 'Otra' }]);
      expect(publicar).toHaveBeenCalledWith('solicitud.homologada', {
        solicitudId: 12,
        resultados: [expect.objectContaining({ resultado: 'Pendiente' }), expect.objectContaining({ resultado: 'Sin materia equivalente' })],
      });
    });

    it('sin sílabo compara por el nombre contra la matriz y avisa al docente (observación 24/11)', async () => {
      const elegirParecida = jest.fn().mockResolvedValue({ codigo: 'SW-CI', parecido: 75 });
      const homologacion = { homologarExterna: jest.fn().mockResolvedValue({ resultado: 'Homologable' }) };
      const { s, clientes, publicar } = armar({ elegirParecida }, {}, homologacion);
      await enviar(s, [{ ...calculoII, silaboId: undefined }]);
      expect(clientes.textoSilabo).not.toHaveBeenCalled();
      expect(elegirParecida).toHaveBeenCalledWith(expect.stringContaining('SIN SÍLABO'), expect.any(Array));
      expect(homologacion.homologarExterna).toHaveBeenCalledWith(expect.objectContaining({ codigoNueva: 'SW-CI', silabo: expect.stringContaining('Cálculo II') }));
      const r = publicar.mock.calls[0][1].resultados[0];
      expect(r.resultado).toBe('Homologable');
      expect(r.informe.aviso).toMatch(/^Sin sílabo/);
    });

    it('sin sílabo y con el mismo nombre no gasta IA para elegir', async () => {
      const elegirParecida = jest.fn();
      const homologacion = { homologarExterna: jest.fn().mockResolvedValue({ resultado: 'Homologable' }) };
      const { s } = armar({ elegirParecida }, {}, homologacion);
      await enviar(s, [{ ...calculoII, nombre: 'Física', silaboId: undefined }]);
      expect(elegirParecida).not.toHaveBeenCalled();
      expect(homologacion.homologarExterna).toHaveBeenCalledWith(expect.objectContaining({ codigoNueva: 'SW-FIS' }));
    });

    it('pide las candidatas al catálogo una sola vez aunque haya varias materias', async () => {
      const { s, clientes } = armar({ elegirParecida: jest.fn().mockResolvedValue(null) });
      await enviar(s, [calculoII, { ...calculoII, codigo: 'EXT-B', nombre: 'B' }]);
      expect(clientes.candidatas).toHaveBeenCalledTimes(1);
    });
  });

  // ---------- HU-26 y HU-29 · materias por partes ----------
  describe('materias juntas (HU-26)', () => {
    const informe = (resultado: string) => ({ resultado, causas: [], temasFaltan: [] });
    const armar = (destino: object[], homologacion: object, agente: object = {}, clientesExtra: object = {}) => {
      process.env.IA_PAUSA_MS = '0';
      const clientes = {
        asignaturas: jest.fn().mockResolvedValue(destino),
        candidatas: jest.fn().mockResolvedValue([]),
        textoSilabo: jest.fn((id: number) => Promise.resolve(`sílabo ${id}`)),
        ...clientesExtra,
      };
      const publicar = jest.fn().mockResolvedValue(true);
      const s = new SolicitudesAgenteService(
        { publicar, escuchar: jest.fn() } as unknown as EventosService,
        clientes as unknown as ClientesService,
        homologacion as unknown as HomologacionService,
        agente as unknown as AgenteService,
      );
      const resultados = () => (publicar.mock.calls[0][1] as { resultados: Record<string, unknown>[] }).resultados;
      return { s, clientes, publicar, resultados };
    };
    const ext = (codigo: string, nombre: string, silaboId: number, extra: object = {}) => ({
      codigo, nombre, creditos: 3, horas: 144, nota: 8, notaOriginal: 16, escala: 20, anio: 2025, silaboId, ...extra,
    });

    it('otra universidad: Física I y Física II se evalúan juntas para FÍSICA', async () => {
      const homologacion = { homologarJuntas: jest.fn().mockResolvedValue(informe('Homologable')), homologarExterna: jest.fn() };
      const { s, resultados } = armar([{ codigo: 'SW-F', nombre: 'FÍSICA' }], homologacion);
      await s.homologarSolicitud({
        solicitudId: 1, tipo: 'EXTERNO', carreraDestino: 'SW',
        materias: [ext('EXT-FISICA-I', 'Física I', 1, { anio: 2024 }), ext('EXT-FISICA-II', 'Física II', 2, { nota: 7, notaOriginal: 14 })],
      });
      expect(homologacion.homologarExterna).not.toHaveBeenCalled();
      expect(homologacion.homologarJuntas).toHaveBeenCalledWith({
        codigoNueva: 'SW-F',
        parecido: 100,
        partes: [
          { codigo: 'EXT-FISICA-I', nombre: 'Física I', creditos: 3, horas: 144, nota: 8, anio: 2024, notaOriginal: 16, escala: 20, silabo: 'sílabo 1' },
          { codigo: 'EXT-FISICA-II', nombre: 'Física II', creditos: 3, horas: 144, nota: 7, anio: 2025, notaOriginal: 14, escala: 20, silabo: 'sílabo 2' },
        ],
      });
      expect(resultados()).toEqual([
        expect.objectContaining({ codigoAprobada: 'EXT-FISICA-I', codigoNueva: 'SW-F', resultado: 'Homologable', juntoCon: ['EXT-FISICA-II'] }),
        expect.objectContaining({ codigoAprobada: 'EXT-FISICA-II', codigoNueva: 'SW-F', resultado: 'Homologable', juntoCon: ['EXT-FISICA-I'] }),
      ]);
    });

    it('otra universidad: dos materias que la IA asocia por temas a la misma materia nueva también se juntan', async () => {
      const agente = { elegirParecida: jest.fn().mockResolvedValueOnce({ codigo: 'SW-F', parecido: 80 }).mockResolvedValueOnce({ codigo: 'SW-F', parecido: 70 }) };
      const homologacion = { homologarJuntas: jest.fn().mockResolvedValue(informe('Homologable')) };
      const { s } = armar([{ codigo: 'SW-F', nombre: 'FÍSICA' }], homologacion, agente);
      await s.homologarSolicitud({ solicitudId: 1, tipo: 'EXTERNO', carreraDestino: 'SW', materias: [ext('EXT-MECANICA', 'Mecánica', 1), ext('EXT-ELECTRO', 'Electromagnetismo', 2)] });
      expect(homologacion.homologarJuntas).toHaveBeenCalledWith(expect.objectContaining({ codigoNueva: 'SW-F', parecido: 70 }));
    });

    it('si falla la evaluación conjunta, las dos quedan Pendiente', async () => {
      const homologacion = { homologarJuntas: jest.fn().mockRejectedValue(new Error('ms-motor-reglas no responde')) };
      const { s, resultados } = armar([{ codigo: 'SW-F', nombre: 'FÍSICA' }], homologacion);
      await s.homologarSolicitud({ solicitudId: 1, tipo: 'EXTERNO', carreraDestino: 'SW', materias: [ext('A', 'Física I', 1), ext('B', 'Física II', 2)] });
      expect(resultados().map((r) => r.resultado)).toEqual(['Pendiente', 'Pendiente']);
    });

    it('otra universidad: Física I sola se evalúa con FÍSICA y, si no alcanza, avisa que registre la otra parte', async () => {
      const homologacion = { homologarExterna: jest.fn().mockResolvedValue(informe('No homologable')) };
      const { s, resultados } = armar([{ codigo: 'SW-F', nombre: 'FÍSICA' }], homologacion);
      await s.homologarSolicitud({ solicitudId: 1, tipo: 'EXTERNO', carreraDestino: 'SW', materias: [ext('A', 'Física I', 1)] });
      expect(homologacion.homologarExterna).toHaveBeenCalledWith(expect.objectContaining({ codigoNueva: 'SW-F', parecido: 100 }));
      const r = resultados()[0] as { resultado: string; informe: { aviso: string } };
      expect(r.resultado).toBe('No homologable');
      expect(r.informe.aviso).toMatch(/parte de FÍSICA/);
    });

    it('UTA: Física I sola dice qué parte de la carrera de origen falta registrar', async () => {
      const catalogo: Record<string, object> = { 'TI-F1': { codigo: 'TI-F1', nombre: 'FISICA I', carrera: { codigo: 'TI', nombre: 'TI' } } };
      const homologacion = { homologar: jest.fn().mockResolvedValue(informe('No homologable')) };
      const { s, resultados } = armar([], homologacion, {}, {
        asignaturas: jest.fn((c: string) => Promise.resolve(c === 'SW' ? [{ codigo: 'SW-F', nombre: 'FISICA' }] : [{ codigo: 'TI-F1', nombre: 'FISICA I' }, { codigo: 'TI-F2', nombre: 'FISICA II' }, { codigo: 'TI-Q', nombre: 'QUIMICA' }])),
        materia: jest.fn((c: string) => Promise.resolve(catalogo[c])),
      });
      await s.homologarSolicitud({ solicitudId: 1, carreraDestino: 'SW', materias: [{ codigo: 'TI-F1', nota: 8, anio: 2025 }] });
      expect(homologacion.homologar).toHaveBeenCalledWith({ codigoAprobada: 'TI-F1', codigoNueva: 'SW-F', nota: 8, anio: 2025 });
      expect((resultados()[0] as { informe: { aviso: string } }).informe.aviso).toBe(
        'Para cubrir FISICA también cuenta FISICA II, que no está en tu solicitud. Si la aprobaste, regístrala para evaluarlas juntas.',
      );
    });

    it('UTA: FISICA I y FISICA II juntas con las unidades del catálogo', async () => {
      const catalogo: Record<string, object> = {
        'TI-F1': { codigo: 'TI-F1', nombre: 'FISICA I', creditos: 3, horasTotales: 144, unidades: [{ numero: 1, contenido: 'Cinemática' }] },
        'TI-F2': { codigo: 'TI-F2', nombre: 'FISICA II', creditos: 3, horasTotales: 144, unidades: [{ numero: 1, contenido: 'Electricidad' }] },
      };
      const homologacion = { homologarJuntas: jest.fn().mockResolvedValue(informe('Homologable')) };
      const { s } = armar([{ codigo: 'SW-F', nombre: 'FISICA' }], homologacion, {}, { materia: jest.fn((c: string) => Promise.resolve(catalogo[c])) });
      await s.homologarSolicitud({ solicitudId: 1, carreraDestino: 'SW', materias: [{ codigo: 'TI-F1', nota: 8, anio: 2025 }, { codigo: 'TI-F2', nota: 9, anio: 2025 }] });
      expect(homologacion.homologarJuntas).toHaveBeenCalledWith({
        codigoNueva: 'SW-F',
        partes: [
          { codigo: 'TI-F1', nombre: 'FISICA I', creditos: 3, horas: 144, nota: 8, anio: 2025, unidades: [{ numero: 1, contenido: 'Cinemática' }] },
          { codigo: 'TI-F2', nombre: 'FISICA II', creditos: 3, horas: 144, nota: 9, anio: 2025, unidades: [{ numero: 1, contenido: 'Electricidad' }] },
        ],
      });
    });

    it('UTA con otro nombre: busca por los temas de la matriz (Fundamentos de Programación → Algoritmos y Lógica)', async () => {
      const fp = { codigo: 'TI-FP', nombre: 'FUNDAMENTOS DE PROGRAMACION', unidades: [{ numero: 1, contenido: 'Java, ciclos, condicionales, listas y archivos' }] };
      const agente = { elegirParecida: jest.fn().mockResolvedValue({ codigo: 'SW-AL', parecido: 100 }) };
      const homologacion = { homologar: jest.fn().mockResolvedValue(informe('Homologable')), homologarJuntas: jest.fn() };
      const { s, resultados } = armar([{ codigo: 'SW-AL', nombre: 'ALGORITMOS Y LOGICA DE PROGRAMACION' }], homologacion, agente, {
        materia: jest.fn().mockResolvedValue(fp),
        candidatas: jest.fn().mockResolvedValue([{ codigo: 'SW-AL', nombre: 'ALGORITMOS Y LOGICA DE PROGRAMACION', unidades: [] }]),
      });
      await s.homologarSolicitud({ solicitudId: 1, carreraDestino: 'SW', materias: [{ codigo: 'TI-FP', nota: 9, anio: 2025 }] });
      expect(agente.elegirParecida).toHaveBeenCalledWith(expect.stringContaining('Java, ciclos'), expect.any(Array));
      expect(homologacion.homologar).toHaveBeenCalledWith({ codigoAprobada: 'TI-FP', codigoNueva: 'SW-AL', nota: 9, anio: 2025 });
      expect(resultados()[0]).toEqual(expect.objectContaining({ codigoNueva: 'SW-AL', resultado: 'Homologable' }));
    });

    it('UTA por temas: dos materias que apuntan a la misma nueva se evalúan cada una (no se juntan)', async () => {
      const cat: Record<string, object> = {
        'TI-A': { codigo: 'TI-A', nombre: 'PROGRAMACION BASICA', unidades: [{ numero: 1, contenido: 'x' }] },
        'TI-B': { codigo: 'TI-B', nombre: 'LOGICA', unidades: [{ numero: 1, contenido: 'y' }] },
      };
      const agente = { elegirParecida: jest.fn().mockResolvedValue({ codigo: 'SW-AL', parecido: 80 }) };
      const homologacion = { homologar: jest.fn().mockResolvedValue(informe('No homologable')), homologarJuntas: jest.fn() };
      const { s } = armar([{ codigo: 'SW-AL', nombre: 'ALGORITMOS' }], homologacion, agente, { materia: jest.fn((c: string) => Promise.resolve(cat[c])) });
      await s.homologarSolicitud({ solicitudId: 1, carreraDestino: 'SW', materias: [{ codigo: 'TI-A', nota: 8, anio: 2025 }, { codigo: 'TI-B', nota: 8, anio: 2025 }] });
      expect(homologacion.homologarJuntas).not.toHaveBeenCalled();
      expect(homologacion.homologar).toHaveBeenCalledTimes(2);
    });

    it('una materia aprobada no cubre dos nuevas: "FISICA" de la UTA no se asocia a "FISICA I" ni a "FISICA II"', async () => {
      const homologacion = { homologar: jest.fn() };
      const { s, resultados } = armar([{ codigo: 'SW-F1', nombre: 'FISICA I' }, { codigo: 'SW-F2', nombre: 'FISICA II' }], homologacion, {}, {
        materia: jest.fn().mockResolvedValue({ codigo: 'TI-F', nombre: 'FISICA' }),
      });
      await s.homologarSolicitud({ solicitudId: 1, carreraDestino: 'SW', materias: [{ codigo: 'TI-F', nota: 8, anio: 2025 }] });
      expect(homologacion.homologar).not.toHaveBeenCalled();
      expect(resultados()).toEqual([{ codigoAprobada: 'TI-F', codigoNueva: null, resultado: 'Sin materia equivalente', informe: null }]);
    });

    it('tres o más materias que apuntan a la misma nueva forman un solo grupo', async () => {
      const homologacion = { homologarJuntas: jest.fn().mockResolvedValue(informe('Homologable')) };
      const { s, resultados } = armar([{ codigo: 'SW-F', nombre: 'FÍSICA' }], homologacion);
      await s.homologarSolicitud({ solicitudId: 1, tipo: 'EXTERNO', carreraDestino: 'SW', materias: [ext('A', 'Física I', 1), ext('B', 'Física II', 2), ext('C', 'Física III', 3)] });
      expect(homologacion.homologarJuntas).toHaveBeenCalledTimes(1);
      expect((homologacion.homologarJuntas.mock.calls[0][0] as { partes: unknown[] }).partes).toHaveLength(3);
      expect(resultados()[2]).toEqual(expect.objectContaining({ codigoAprobada: 'C', juntoCon: ['A', 'B'] }));
    });

    it('una materia de igual nombre no se junta con otra que es solo parte', async () => {
      const homologacion = { homologarExterna: jest.fn().mockResolvedValue(informe('Homologable')), homologarJuntas: jest.fn() };
      const { s } = armar([{ codigo: 'SW-F', nombre: 'FÍSICA' }], homologacion);
      await s.homologarSolicitud({ solicitudId: 1, tipo: 'EXTERNO', carreraDestino: 'SW', materias: [ext('A', 'Física', 1), ext('B', 'Física II', 2)] });
      expect(homologacion.homologarJuntas).not.toHaveBeenCalled();
      expect(homologacion.homologarExterna).toHaveBeenCalledTimes(2);
    });
  });
});
