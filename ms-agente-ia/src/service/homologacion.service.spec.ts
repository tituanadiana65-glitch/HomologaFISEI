import { BadRequestException } from '@nestjs/common';
import { HomologacionService, juntarSilabos, promedioPorCreditos } from './homologacion.service';
import { AgenteService } from './agente.service';
import { ClientesService } from './clientes.service';
import { PrismaService } from '../repository/prisma.service';
import { EventosService } from '../events/eventos.service';
import type { MateriaCatalogo } from '../dto/tipos';

const materias: Record<string, MateriaCatalogo> = {
  TI: { codigo: 'TI', nombre: 'CALCULO INTEGRAL', creditos: 2, horasTotales: 96, unidades: [{ numero: 1, contenido: 'Integrales' }] },
  SW: { codigo: 'SW', nombre: 'CALCULO INTEGRAL', creditos: 3, horasTotales: 144, unidades: [{ numero: 1, contenido: 'Integrales' }] },
  'SW-F': { codigo: 'SW-F', nombre: 'FISICA', creditos: 5, horasTotales: 240, unidades: [{ numero: 1, contenido: 'Cinemática' }, { numero: 2, contenido: 'Electricidad' }] },
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

// HU-26 (RN-10) · dos materias aprobadas juntas frente a una nueva
describe('HomologacionService · materias juntas (HU-26)', () => {
  const fisicaI = { codigo: 'EXT-FISICA-I', nombre: 'Física I', creditos: 3, horas: 144, nota: 8, notaOriginal: 16, escala: 20, anio: 2024, silabo: 'Cinemática y dinámica' };
  const fisicaII = { codigo: 'EXT-FISICA-II', nombre: 'Física II', creditos: 3, horas: 144, nota: 7, notaOriginal: 14, escala: 20, anio: 2025, silabo: 'Electricidad y magnetismo' };

  it('promedio de la nota según los créditos', () => {
    expect(promedioPorCreditos([{ nota: 8, creditos: 3 }, { nota: 6, creditos: 1 }])).toBe(7.5);
    expect(promedioPorCreditos([{ nota: 8, creditos: 0 }, { nota: 6, creditos: 0 }])).toBe(7);
  });

  it('junta los sílabos con el nombre de cada materia y sin pasar el largo', () => {
    const texto = juntarSilabos([{ nombre: 'A', silabo: 'x'.repeat(9000) }, { nombre: 'B', silabo: 'y'.repeat(9000) }]);
    expect(texto).toContain('--- A ---');
    expect(texto).toContain('--- B ---');
    expect(texto.length).toBeLessThanOrEqual(12_000);
  });

  it('otra universidad: compara los dos sílabos juntos y suma créditos y horas', async () => {
    const { s, clientes, agente, prisma } = armar();
    clientes.evaluar.mockResolvedValue({
      homologable: true,
      reglas: [
        { regla: 'RN-02', cumple: true, causa: 'Créditos 6 de 5 = 120 % (mínimo 80 %)' },
        { regla: 'RN-04', cumple: true, causa: 'Nota 7.5 (mínimo 7)' },
        { regla: 'RN-05', cumple: true, causa: 'Aprobada hace 2 años (máximo 10)' },
      ],
    });
    const r = await s.homologarJuntas({ partes: [fisicaI, fisicaII], codigoNueva: 'SW-F', parecido: 90 });
    expect(agente.compararConSilabo).toHaveBeenCalledWith(expect.stringContaining('--- Física II ---'), materias['SW-F'], 80);
    expect(clientes.evaluar).toHaveBeenCalledWith({ creditos: 6, horas: 288, nota: 7.5, anio: 2024 }, { creditos: 5, horas: 240 });
    expect(r.resultado).toBe('Homologable');
    expect(r.juntas).toEqual(['Física I', 'Física II']);
    expect(r.aprobada).toBe('Física I + Física II (EXT-FISICA-I + EXT-FISICA-II)');
    expect(r.parecido).toBe(90);
    const causa = (regla: string) => r.causas.find((c) => c.regla === regla)!.causa;
    expect(causa('RN-01')).toMatch(/^Temas de Física I \+ Física II juntas/);
    expect(causa('RN-02')).toMatch(/^Créditos sumados de las 2 materias/);
    expect(causa('RN-04')).toBe('Promedio 7,5/10 según créditos (Física I 16/20 y Física II 14/20) (mínimo 7)');
    expect(causa('RN-05')).toMatch(/^Se toma la más antigua \(2024\)/);
    expect(prisma.homologacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ codigoAprobada: 'EXT-FISICA-I + EXT-FISICA-II', codigoNueva: 'SW-F' }) });
  });

  it('UTA: compara las unidades de las dos materias juntas', async () => {
    const { s, agente } = armar();
    const partes = [
      { codigo: 'TI-F1', nombre: 'FISICA I', creditos: 3, horas: 144, nota: 8, anio: 2025, unidades: [{ numero: 1, contenido: 'Cinemática' }] },
      { codigo: 'TI-F2', nombre: 'FISICA II', creditos: 3, horas: 144, nota: 9, anio: 2025, unidades: [{ numero: 1, contenido: 'Electricidad' }] },
    ];
    await s.homologarJuntas({ partes, codigoNueva: 'SW-F' });
    expect(agente.comparar).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: 'FISICA I + FISICA II', unidades: [{ numero: 1, contenido: 'FISICA I: Cinemática' }, { numero: 2, contenido: 'FISICA II: Electricidad' }] }),
      materias['SW-F'],
      80,
    );
    expect(agente.compararConSilabo).not.toHaveBeenCalled();
  });

  it('pide al menos dos materias', async () => {
    const { s } = armar();
    await expect(s.homologarJuntas({ partes: [fisicaI], codigoNueva: 'SW-F' })).rejects.toThrow(BadRequestException);
  });
});

// Lectura del récord: el servicio pide el texto a ms-documentos y, para la UTA, une con el catálogo
describe('HomologacionService · leer el récord', () => {
  it('lee el récord y lo une con la carrera de origen', async () => {
    const { s, clientes, agente } = armar();
    clientes.textoSilabo = jest.fn().mockResolvedValue('RÉCORD ... FISICA 8,5 APROBADA');
    clientes.asignaturasConDatos = jest.fn().mockResolvedValue([{ codigo: 'TI-F', nombre: 'FISICA', nivel: 'PRIMERO', docente: 'Ing. P' }]);
    agente.leerRecord = jest.fn().mockResolvedValue([
      { nombre: 'Fisica', creditos: 3, horas: 144, nota: 8.5, escala: 10, anio: 2025, periodo: null, estado: 'APROBADA', veces: 1 },
      { nombre: 'Química', creditos: 3, horas: 144, nota: 5, escala: 10, anio: 2025, periodo: null, estado: 'REPROBADA', veces: 1 },
    ]);
    const r = await s.leerRecord({ documentoId: 4, carreraOrigen: 'TI' });
    expect(clientes.textoSilabo).toHaveBeenCalledWith(4);
    expect(r.aprobadas).toBe(1);
    expect(r.reprobadas).toBe(1);
    expect(r.materias[0]).toEqual(expect.objectContaining({ codigo: 'TI-F', nivel: 'PRIMERO' }));
  });

  it('pide el documento y rechaza un PDF sin texto', async () => {
    const { s, clientes } = armar();
    await expect(s.leerRecord({})).rejects.toThrow(BadRequestException);
    clientes.textoSilabo = jest.fn().mockResolvedValue('   ');
    await expect(s.leerRecord({ documentoId: 1 })).rejects.toThrow('no tiene texto');
  });
});
