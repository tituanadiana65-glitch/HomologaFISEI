import { BadRequestException } from '@nestjs/common';
import { HomologacionService } from './homologacion.service';
import { AgenteService } from './agente.service';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../repository/prisma.service';
import { EventosService } from '../events/eventos.service';
import type { MateriaCatalogo } from '../dto/tipos';

const materias: Record<string, MateriaCatalogo> = {
  TI: { codigo: 'TI', nombre: 'CALCULO INTEGRAL', creditos: 2, horasTotales: 96, unidades: [{ numero: 1, contenido: 'Integrales' }] },
  SW: { codigo: 'SW', nombre: 'CALCULO INTEGRAL', creditos: 3, horasTotales: 144, unidades: [{ numero: 1, contenido: 'Integrales' }] },
};

function armar() {
  const clientes = {
    materia: jest.fn((c: string) => Promise.resolve(materias[c])),
    minimoContenidos: jest.fn().mockResolvedValue(80),
    evaluar: jest.fn().mockResolvedValue({ homologable: false, reglas: [{ regla: 'RN-02', cumple: false, causa: 'Créditos 2 de 3 = 66,66 %' }] }),
  };
  const agente = { comparar: jest.fn().mockResolvedValue({ disponible: true, cumple: true, porcentaje: 95, coinciden: ['Integrales'], faltan: [], explicacion: 'Iguales.' }) };
  const prisma = { homologacion: { create: jest.fn().mockResolvedValue({ id: 1, fecha: new Date('2026-10-21T10:00:00Z') }) } };
  const eventos = { publicar: jest.fn().mockResolvedValue(true) };
  const s = new HomologacionService(
    agente as unknown as AgenteService,
    clientes as unknown as ClientesService,
    prisma as unknown as PrismaService,
    eventos as unknown as EventosService,
  );
  return { s, clientes, prisma, eventos };
}

describe('HomologacionService', () => {
  it('Cálculo Integral TI → SW: No homologable, se guarda y se publica el evento', async () => {
    const { s, clientes, prisma, eventos } = armar();
    const r = await s.homologar({ codigoAprobada: 'TI', codigoNueva: 'SW', nota: 8.5, anio: 2025 });
    expect(r.resultado).toBe('No homologable');
    expect(clientes.evaluar).toHaveBeenCalledWith({ creditos: 2, horas: 96, nota: 8.5, anio: 2025 }, { creditos: 3, horas: 144 });
    expect(prisma.homologacion.create).toHaveBeenCalled();
    expect(eventos.publicar).toHaveBeenCalledWith('homologacion.completada', expect.objectContaining({ id: 1 }));
  });

  it('pide los dos códigos', async () => {
    const { s } = armar();
    await expect(s.homologar({ codigoAprobada: 'TI', codigoNueva: '' })).rejects.toThrow(BadRequestException);
  });
});
