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
