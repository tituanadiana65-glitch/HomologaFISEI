import { codigoExterno, convertirNota } from './notas';

describe('convertirNota (T41)', () => {
  it('pasa una nota sobre 20 a la escala sobre 10', () => {
    expect(convertirNota(16, 20)).toBe(8);
  });

  it('pasa una nota sobre 100 a la escala sobre 10', () => {
    expect(convertirNota(85, 100)).toBe(8.5);
  });

  it('deja igual una nota que ya está sobre 10', () => {
    expect(convertirNota(7, 10)).toBe(7);
  });

  it('redondea a dos decimales', () => {
    expect(convertirNota(14.3, 20)).toBe(7.15);
    expect(convertirNota(2, 3 as never)).toBe(6.67);
  });
});

describe('codigoExterno (T38)', () => {
  it('arma el código con el nombre, sin tildes ni espacios', () => {
    expect(codigoExterno('Cálculo II')).toBe('EXT-CALCULO-II');
  });

  it('da el mismo código aunque cambien mayúsculas o espacios', () => {
    expect(codigoExterno('  cálculo   ii ')).toBe(codigoExterno('CALCULO II'));
  });
});
