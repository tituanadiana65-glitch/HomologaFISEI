import { buscarEquivalente } from './equivalencia';

const software = [
  { codigo: 'UTA-FISEI-SF-MP-UB-02-02', nombre: 'CÁLCULO INTEGRAL' },
  { codigo: 'UTA-FISEI-SF-MP-UP-02-04', nombre: 'PROGRAMACIÓN ORIENTADA A OBJETOS' },
];

describe('buscarEquivalente', () => {
  it('encuentra la materia con el mismo nombre, sin importar tildes ni mayúsculas', () => {
    expect(buscarEquivalente('Calculo Integral', software)?.codigo).toBe('UTA-FISEI-SF-MP-UB-02-02');
  });
  it('no inventa un equivalente', () => {
    expect(buscarEquivalente('Fundamentos de Programación', software)).toBeUndefined();
  });
});
