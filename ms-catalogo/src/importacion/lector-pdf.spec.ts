import { readFileSync } from 'fs';
import { join } from 'path';
import { candidatosHoras, carreraDesdeCodigo, elegirHoras, leerPlan, validarPlan } from './lector-pdf';

const fixture = (n: string) => readFileSync(join(__dirname, '../../test/fixtures', n));

describe('lector de planes analíticos', () => {
  it('lee Cálculo Integral de TI', async () => {
    const p = await leerPlan(fixture('calculo-integral-ti.pdf'));
    expect(p.codigo).toBe('UTA-FISEI-TI-MP-UB-02-01');
    expect(p.nombre).toBe('CALCULO INTEGRAL');
    expect(p.nivel).toBe('SEGUNDO');
    expect(p.creditos).toBe(2);
    expect(p.horasTotales).toBe(96);
    expect(p.prerrequisitos[0]).toEqual({ nombre: 'CALCULO DIFERENCIAL', codigo: 'UTA-FISEI-TI-MP-UB-01-03' });
    expect(p.unidades.map((u) => u.horas)).toEqual([24, 24, 24, 24]);
    expect(p.unidades[0].contenido).toContain('Integral definida');
  });

  it('lee Cálculo Integral de Software (3 créditos, 144 horas)', async () => {
    const p = await leerPlan(fixture('calculo-integral-sw.pdf'));
    expect(p.codigo).toBe('UTA-FISEI-SF-MP-UB-02-02');
    expect(p.carrera).toBe('Software');
    expect(p.creditos).toBe(3);
    expect(p.horasTotales).toBe(144);
  });

  it('las horas de las unidades suman el total aunque vengan como "36: Los..."', async () => {
    const p = await leerPlan(fixture('probabilidad-sw.pdf'));
    expect(p.unidades.reduce((s, u) => s + u.horas, 0)).toBe(p.horasTotales);
  });

  it('encuentra horas pegadas a siglas y a palabras con número', () => {
    expect(candidatosHoras('de TI36Ejecuta').map((c) => c.valor)).toContain(36);
    expect(candidatosHoras('htaml539Desarrolla').map((c) => c.valor)).toContain(39);
  });

  it('elige la combinación de horas que suma el total', () => {
    const c = [candidatosHoras('html5Manejo y 24Maneja'), candidatosHoras('htaml539Desarrolla')];
    expect(elegirHoras(c, 63).map((x) => x?.valor)).toEqual([24, 39]);
  });

  it('reconoce la carrera por la sigla del código', () => {
    expect(carreraDesdeCodigo('UTA-FISEI-TI-MP-UB-02-01')).toBe('TI');
    expect(carreraDesdeCodigo('UTA-FISEI-SF-MP-UB-02-02')).toBe('SW');
  });

  it('rechaza un archivo que no es un plan analítico', () => {
    expect(validarPlan({})).toEqual(['código', 'créditos', 'horas', 'unidades']);
  });
});
