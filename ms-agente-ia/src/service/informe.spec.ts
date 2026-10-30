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
});
