import { porcentaje, ReglasService } from './reglas.service';
import { ConfigReglas, MateriaReglas } from '../dto/evaluar.dto';

const config: ConfigReglas = { creditosMinimo: 0.8, horasMinimo: 0.8, notaMinima: 7, maxAnios: 10 };
const s = new ReglasService();
const destino: MateriaReglas = { creditos: 3, horas: 144 };
const m = (o: Partial<MateriaReglas>): MateriaReglas => ({ creditos: 3, horas: 144, nota: 8, anio: 2024, ...o });

describe('ReglasService', () => {
  it('calcula el porcentaje truncado: 2/3 = 66,66', () => {
    expect(porcentaje(2, 3)).toBe('66,66');
  });

  it('RN-02: 2 de 3 créditos (66,66 %) NO cumple', () => {
    const r = s.creditos(m({ creditos: 2 }), destino, config);
    expect(r.cumple).toBe(false);
    expect(r.causa).toContain('66,66 %');
  });

  it('RN-02: 3 de 3 créditos SÍ cumple', () => {
    expect(s.creditos(m({}), destino, config).cumple).toBe(true);
  });

  it('RN-03: 120 de 144 horas (83 %) SÍ cumple', () => {
    expect(s.horas(m({ horas: 120 }), destino, config).cumple).toBe(true);
  });

  it('RN-03: 96 de 144 horas (66,66 %) NO cumple', () => {
    expect(s.horas(m({ horas: 96 }), destino, config).cumple).toBe(false);
  });

  it('RN-04: nota 7 cumple y 6.9 no', () => {
    expect(s.nota(m({ nota: 7 }), config)?.cumple).toBe(true);
    expect(s.nota(m({ nota: 6.9 }), config)?.cumple).toBe(false);
  });

  it('RN-05: aprobada en 2018 cumple y en 2015 no (año 2026)', () => {
    expect(s.vigencia(m({ anio: 2018 }), config, 2026)?.cumple).toBe(true);
    expect(s.vigencia(m({ anio: 2015 }), config, 2026)?.cumple).toBe(false);
  });

  it('Cálculo Integral TI (2 cr, 96 h) frente a SW (3 cr, 144 h): No homologable', () => {
    const r = s.evaluar({ creditos: 2, horas: 96, nota: 8.5, anio: 2025 }, destino, config, 2026);
    expect(r.homologable).toBe(false);
    expect(r.reglas.filter((x) => !x.cumple).map((x) => x.regla)).toEqual(['RN-02', 'RN-03']);
  });

  it('Física TI frente a Física SW (3 cr, 144 h): Homologable', () => {
    const r = s.evaluar({ creditos: 3, horas: 144, nota: 8.5, anio: 2025 }, destino, config, 2026);
    expect(r.homologable).toBe(true);
    expect(r.reglas).toHaveLength(4);
  });

  it('sin nota ni año solo evalúa créditos y horas', () => {
    expect(s.evaluar({ creditos: 3, horas: 144 }, destino, config).reglas.map((r) => r.regla)).toEqual(['RN-02', 'RN-03']);
  });
});
