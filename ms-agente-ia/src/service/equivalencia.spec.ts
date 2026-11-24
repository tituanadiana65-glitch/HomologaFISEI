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

// HU-26 · materias divididas en partes (I, II)
import { buscarPorNombre, nombreBase, tieneNumero } from './equivalencia';

describe('materias por partes (HU-26)', () => {
  const destino = [
    { codigo: 'F', nombre: 'FÍSICA' },
    { codigo: 'C2', nombre: 'CÁLCULO II' },
    { codigo: 'C1', nombre: 'CÁLCULO I' },
    { codigo: 'BD', nombre: 'BASE DE DATOS' },
  ];

  it('quita el número del final (romano o arábigo)', () => {
    expect(nombreBase('Física II')).toBe('FISICA');
    expect(nombreBase('Cálculo 1')).toBe('CALCULO');
    expect(nombreBase('Base de Datos')).toBe('BASE DE DATOS');
    expect(tieneNumero('Física III')).toBe(true);
    expect(tieneNumero('Física')).toBe(false);
  });

  it('el mismo nombre sigue siendo una con una', () => {
    expect(buscarPorNombre('Física', destino)).toEqual({ exacta: destino[0] });
  });

  it('HU-26: "Física I" es una parte de "FÍSICA"', () => {
    expect(buscarPorNombre('Física I', destino).base).toEqual(destino[0]);
  });

  it('una materia aprobada no cubre dos nuevas: "Cálculo" no se asocia a "CÁLCULO I" ni a "CÁLCULO II"', () => {
    expect(buscarPorNombre('Cálculo', destino)).toEqual({ base: undefined });
  });

  it('sin relación por nombre no devuelve nada', () => {
    expect(buscarPorNombre('Química', destino)).toEqual({ base: undefined });
  });
});
