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

    it('si la materia no trae sílabo queda Pendiente', async () => {
      const { s, publicar } = armar({ elegirParecida: jest.fn() });
      await enviar(s, [{ ...calculoII, silaboId: undefined }]);
      expect(publicar).toHaveBeenCalledWith('solicitud.homologada', { solicitudId: 12, resultados: [expect.objectContaining({ resultado: 'Pendiente' })] });
    });

    it('pide las candidatas al catálogo una sola vez aunque haya varias materias', async () => {
      const { s, clientes } = armar({ elegirParecida: jest.fn().mockResolvedValue(null) });
      await enviar(s, [calculoII, { ...calculoII, codigo: 'EXT-B', nombre: 'B' }]);
      expect(clientes.candidatas).toHaveBeenCalledTimes(1);
    });
  });
});
