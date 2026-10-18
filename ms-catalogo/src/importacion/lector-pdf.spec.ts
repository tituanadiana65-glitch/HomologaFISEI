import { buscarNumero, validarPlan } from './lector-pdf';

describe('lector de planes analíticos', () => {
  it('lee los créditos', () => {
    expect(buscarNumero('Asignatura: Física Créditos: 3 Horas: 144', 'Créditos')).toBe(3);
  });
  it('devuelve null si no encuentra la etiqueta', () => {
    expect(buscarNumero('Sin datos', 'Créditos')).toBeNull();
  });
  it('rechaza un archivo que no es un plan analítico', () => {
    expect(validarPlan({})).toEqual(['código', 'créditos', 'horas', 'unidades']);
  });
});