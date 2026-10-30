import { Injectable } from '@nestjs/common';
import { ConfigReglas, Evaluacion, MateriaReglas, ResultadoRegla } from '../dto/evaluar.dto';

// Porcentaje truncado a 2 decimales, con coma: 2/3 -> "66,66"
export const porcentaje = (a: number, b: number): string =>
  (Math.floor((a / b) * 10000) / 100).toFixed(2).replace('.', ',');

const pct = (v: number) => `${Math.round(v * 100)} %`;

@Injectable()
export class ReglasService {
  creditos(o: MateriaReglas, d: MateriaReglas, c: ConfigReglas): ResultadoRegla {
    const cumple = o.creditos / d.creditos >= c.creditosMinimo;
    return {
      regla: 'RN-02',
      cumple,
      causa: `Créditos ${o.creditos} de ${d.creditos} = ${porcentaje(o.creditos, d.creditos)} % (mínimo ${pct(c.creditosMinimo)})`,
    };
  }

  horas(o: MateriaReglas, d: MateriaReglas, c: ConfigReglas): ResultadoRegla {
    const cumple = o.horas / d.horas >= c.horasMinimo;
    return {
      regla: 'RN-03',
      cumple,
      causa: `Horas ${o.horas} de ${d.horas} = ${porcentaje(o.horas, d.horas)} % (mínimo ${pct(c.horasMinimo)})`,
    };
  }

  nota(o: MateriaReglas, c: ConfigReglas): ResultadoRegla | null {
    if (o.nota === undefined || o.nota === null) return null;
    return {
      regla: 'RN-04',
      cumple: o.nota >= c.notaMinima,
      causa: `Nota ${o.nota} (mínimo ${c.notaMinima})`,
    };
  }

  vigencia(o: MateriaReglas, c: ConfigReglas, anioActual = new Date().getFullYear()): ResultadoRegla | null {
    if (!o.anio) return null;
    const anios = anioActual - o.anio;
    return {
      regla: 'RN-05',
      cumple: anios <= c.maxAnios,
      causa: `Aprobada hace ${anios} ${anios === 1 ? 'año' : 'años'} (máximo ${c.maxAnios})`,
    };
  }

  evaluar(o: MateriaReglas, d: MateriaReglas, c: ConfigReglas, anioActual?: number): Evaluacion {
    const reglas = [
      this.creditos(o, d, c),
      this.horas(o, d, c),
      this.nota(o, c),
      this.vigencia(o, c, anioActual),
    ].filter((r): r is ResultadoRegla => r !== null);
    return { homologable: reglas.every((r) => r.cumple), reglas };
  }
}
