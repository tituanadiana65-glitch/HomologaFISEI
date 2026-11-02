import { SolicitudesAgenteService } from './solicitudes.service';
import type { EventosService } from '../events/eventos.service';
import type { ClientesService } from './clientes.service';
import type { HomologacionService } from './homologacion.service';

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
    );
    await s.homologarSolicitud({ solicitudId: 8, carreraDestino: 'SW', materias: [{ codigo: 'X', nota: 8, anio: 2025 }] });
    expect(publicar).toHaveBeenCalledWith('solicitud.homologada', { solicitudId: 8, resultados: [expect.objectContaining({ resultado: 'Pendiente' })] });
  });
});
