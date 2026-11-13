import { armarInforme } from './informe';
import type { Comparacion, MateriaCatalogo } from '../dto/tipos';

const calculoTI: MateriaCatalogo = { codigo: 'UTA-FISEI-TI-MP-UB-02-01', nombre: 'CALCULO INTEGRAL', creditos: 2, horasTotales: 96, unidades: [] };
const calculoSW: MateriaCatalogo = {
  codigo: 'UTA-FISEI-SF-MP-UB-02-02', nombre: 'CALCULO INTEGRAL', creditos: 3, horasTotales: 144, unidades: [],
  requisitos: [{ tipo: 'PRE', codigo: 'X', nombre: 'CALCULO DIFERENCIAL' }],
};
const contenidosOk: Comparacion = { disponible: true, cumple: true, porcentaje: 90, coinciden: ['Integrales'], faltan: [], explicacion: 'Mismos temas.' };

describe('armarInforme', () => {
  it('Cálculo Integral: temas iguales pero 2 de 3 créditos = No homologable', () => {
    const reglas = { homologable: false, reglas: [{ regla: 'RN-02', cumple: false, causa: 'Créditos 2 de 3 = 66,66 %' }] };
    const i = armarInforme(calculoTI, calculoSW, contenidosOk, reglas);
    expect(i.resultado).toBe('No homologable');
    expect(i.causas.find((c) => c.regla === 'RN-01')?.cumple).toBe(true);
    expect(i.causas.find((c) => c.regla === 'RN-02')?.cumple).toBe(false);
  });

  it('contenidos y reglas bien = Homologable', () => {
    expect(armarInforme(calculoTI, calculoSW, contenidosOk, { homologable: true, reglas: [] }).resultado).toBe('Homologable');
  });

  it('contenidos bajo el 80 % = No homologable', () => {
    const bajo = { ...contenidosOk, cumple: false, porcentaje: 40 };
    expect(armarInforme(calculoTI, calculoSW, bajo, { homologable: true, reglas: [] }).resultado).toBe('No homologable');
  });

  it('sin respuesta de la IA y reglas bien = Pendiente', () => {
    const sinIA = { ...contenidosOk, disponible: false, cumple: false, explicacion: 'falta el análisis de contenidos' };
    expect(armarInforme(calculoTI, calculoSW, sinIA, { homologable: true, reglas: [] }).resultado).toBe('Pendiente');
  });

  it('informa los prerrequisitos de la materia nueva (RN-06)', () => {
    expect(armarInforme(calculoTI, calculoSW, contenidosOk, { homologable: true, reglas: [] }).prerrequisitosNueva).toEqual(['CALCULO DIFERENCIAL']);
  });

  // ---------- T48 · materia de otra universidad ----------
  const calculoII: MateriaCatalogo = { codigo: 'EXT-CALCULO-II', nombre: 'Cálculo II', creditos: 4, horasTotales: 160, unidades: [] };
  const reglasExternas = {
    homologable: true,
    reglas: [
      { regla: 'RN-02', cumple: true, causa: 'Créditos 4 de 3 = 133,33 % (mínimo 80 %)' },
      { regla: 'RN-03', cumple: true, causa: 'Horas 160 de 144 = 111,11 % (mínimo 80 %)' },
      { regla: 'RN-04', cumple: true, causa: 'Nota 8 (mínimo 7)' },
      { regla: 'RN-05', cumple: true, causa: 'Aprobada hace 1 año (máximo 10)' },
    ],
  };
  const faltaUnTema: Comparacion = { ...contenidosOk, porcentaje: 85, faltan: ['Series de potencias'] };

  it('T48: el informe externo trae parecido, notaOriginal y escala', () => {
    const i = armarInforme(calculoII, calculoSW, faltaUnTema, reglasExternas, 80, { parecido: 82, notaOriginal: 16, escala: 20, nota: 8 });
    expect(i).toMatchObject({ resultado: 'Homologable', parecido: 82, notaOriginal: 16, escala: 20, temasFaltan: ['Series de potencias'] });
  });

  it('T48: la causa de RN-04 dice «16/20 equivale a 8,0/10 (mínimo 7)»', () => {
    const i = armarInforme(calculoII, calculoSW, faltaUnTema, reglasExternas, 80, { parecido: 82, notaOriginal: 16, escala: 20, nota: 8 });
    expect(i.causas.find((c) => c.regla === 'RN-04')?.causa).toBe('16/20 equivale a 8,0/10 (mínimo 7)');
  });

  it('T48: trae las 5 reglas, cada una con su causa', () => {
    const i = armarInforme(calculoII, calculoSW, faltaUnTema, reglasExternas, 80, { parecido: 82, notaOriginal: 16, escala: 20, nota: 8 });
    expect(i.causas.map((c) => c.regla)).toEqual(['RN-01', 'RN-02', 'RN-03', 'RN-04', 'RN-05']);
    expect(i.causas.every((c) => c.causa.length > 0)).toBe(true);
  });

  it('T48: una materia de la UTA no cambia (sin parecido ni escala)', () => {
    const i = armarInforme(calculoTI, calculoSW, contenidosOk, reglasExternas);
    expect(i.parecido).toBeUndefined();
    expect(i.causas.find((c) => c.regla === 'RN-04')?.causa).toBe('Nota 8 (mínimo 7)');
  });
});
