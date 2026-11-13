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
  const agente = {
    compararConSilabo: jest.fn().mockResolvedValue({ disponible: true, cumple: true, porcentaje: 85, coinciden: ['Integrales'], faltan: [], explicacion: 'Casi iguales.' }),
    comparar: jest.fn().mockResolvedValue({ disponible: true, cumple: true, porcentaje: 95, coinciden: ['Integrales'], faltan: [], explicacion: 'Iguales.' }) };
  const prisma = { homologacion: { create: jest.fn().mockResolvedValue({ id: 1, fecha: new Date('2026-10-21T10:00:00Z') }) } };
  const eventos = { publicar: jest.fn().mockResolvedValue(true) };
  const s = new HomologacionService(
    agente as unknown as AgenteService,
    clientes as unknown as ClientesService,
    prisma as unknown as PrismaService,
    eventos as unknown as EventosService,
  );
  return { s, clientes, prisma, eventos, agente };
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

  it('T44: compara un sílabo con la materia nueva y el mínimo de RN-01', async () => {
    const { s, agente } = armar();
    const r = await s.compararSilabo({ silabo: 'Integrales y series', codigoNueva: 'SW' });
    expect(agente.compararConSilabo).toHaveBeenCalledWith('Integrales y series', materias.SW, 80);
    expect(r.porcentaje).toBe(85);
  });

  it('T44: pide el sílabo y el código de la materia nueva', async () => {
    const { s } = armar();
    await expect(s.compararSilabo({ silabo: '  ', codigoNueva: 'SW' })).rejects.toThrow(BadRequestException);
    await expect(s.compararSilabo({ silabo: 'algo', codigoNueva: '' })).rejects.toThrow(BadRequestException);
  });

  // ---------- T46 · materia de otra universidad ----------
  const externa = { codigoAprobada: 'EXT-CALCULO-II', nombre: 'Cálculo II', silabo: 'Integrales y series', codigoNueva: 'SW', creditos: 4, horas: 160, nota: 8, anio: 2025 };

  it('T46: evalúa las reglas con los datos del estudiante, no del catálogo', async () => {
    const { s, clientes, agente } = armar();
    clientes.evaluar.mockResolvedValueOnce({ homologable: true, reglas: [{ regla: 'RN-02', cumple: true, causa: 'Créditos 4 de 3 = 133,33 %' }] });
    const r = await s.homologarExterna(externa);
    expect(clientes.evaluar).toHaveBeenCalledWith({ creditos: 4, horas: 160, nota: 8, anio: 2025 }, { creditos: 3, horas: 144 });
    expect(agente.compararConSilabo).toHaveBeenCalledWith('Integrales y series', materias.SW, 80);
    expect(clientes.materia).not.toHaveBeenCalledWith('EXT-CALCULO-II');
    expect(r.resultado).toBe('Homologable');
    expect(r.aprobada).toBe('Cálculo II (EXT-CALCULO-II)');
  });

  it('T48: el informe guarda parecido, nota original y escala', async () => {
    const { s, clientes } = armar();
    clientes.evaluar.mockResolvedValueOnce({ homologable: true, reglas: [{ regla: 'RN-04', cumple: true, causa: 'Nota 8 (mínimo 7)' }] });
    const r = await s.homologarExterna({ ...externa, parecido: 82, notaOriginal: 16, escala: 20 });
    expect(r).toMatchObject({ parecido: 82, notaOriginal: 16, escala: 20 });
    expect(r.causas.find((c) => c.regla === 'RN-04')?.causa).toBe('16/20 equivale a 8,0/10 (mínimo 7)');
  });

  it('T46: se guarda el informe y se publica el evento', async () => {
    const { s, prisma, eventos } = armar();
    await s.homologarExterna(externa);
    expect(prisma.homologacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ codigoAprobada: 'EXT-CALCULO-II', codigoNueva: 'SW', nota: 8, anio: 2025 }) });
    expect(eventos.publicar).toHaveBeenCalledWith('homologacion.completada', expect.objectContaining({ id: 1 }));
  });

  it('T46: pide créditos y horas mayores a 0, y el sílabo', async () => {
    const { s } = armar();
    await expect(s.homologarExterna({ ...externa, creditos: 0 })).rejects.toThrow('créditos y horas');
    await expect(s.homologarExterna({ ...externa, horas: 0 })).rejects.toThrow('créditos y horas');
    await expect(s.homologarExterna({ ...externa, silabo: ' ' })).rejects.toThrow(BadRequestException);
  });
});
