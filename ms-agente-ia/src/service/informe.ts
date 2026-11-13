import type { Causa, Comparacion, Informe, MateriaCatalogo, Resultado, ResultadoReglas } from '../dto/tipos';

// T48 · Datos extra de una materia de otra universidad
export interface DatosExternos {
  parecido?: number;
  notaOriginal?: number;
  escala?: number;
  nota?: number; // ya convertida sobre 10
}

const coma = (n: number) => n.toFixed(1).replace('.', ',');

// T12 · Une la decisión del agente (contenidos, RN-01) con la del motor de reglas (RN-02 a RN-05).
export function armarInforme(
  aprobada: MateriaCatalogo,
  nueva: MateriaCatalogo,
  contenidos: Comparacion,
  reglas: ResultadoReglas,
  minimo = 80,
  externo?: DatosExternos,
): Informe {
  const rn01: Causa = {
    regla: 'RN-01',
    cumple: contenidos.cumple,
    causa: contenidos.disponible
      ? `Contenidos ${contenidos.porcentaje} % (mínimo ${minimo} %). ${contenidos.explicacion}`.trim()
      : contenidos.explicacion,
  };
  // T48 · "16/20 equivale a 8,0/10 (mínimo 7)": la nota se explica con lo que escribió el estudiante
  const explicarNota = (c: Causa): Causa =>
    c.regla === 'RN-04' && externo?.notaOriginal !== undefined && externo.escala && externo.nota !== undefined
      ? { ...c, causa: c.causa.replace(/^Nota [\d.,]+/, `${externo.notaOriginal}/${externo.escala} equivale a ${coma(externo.nota)}/10`) }
      : c;
  const causas = [rn01, ...reglas.reglas.map(explicarNota)];
  let resultado: Resultado;
  if (!reglas.homologable || (contenidos.disponible && !contenidos.cumple)) resultado = 'No homologable';
  else resultado = contenidos.disponible ? 'Homologable' : 'Pendiente';
  return {
    aprobada: `${aprobada.nombre} (${aprobada.codigo})`,
    nueva: `${nueva.nombre} (${nueva.codigo})`,
    resultado,
    porcentaje: contenidos.porcentaje,
    causas,
    temasCoinciden: contenidos.coinciden,
    temasFaltan: contenidos.faltan,
    // RN-06: se informan, no bloquean
    prerrequisitosNueva: (nueva.requisitos ?? []).filter((r) => r.tipo === 'PRE').map((r) => r.nombre),
    ...(externo?.parecido !== undefined ? { parecido: externo.parecido } : {}),
    ...(externo?.notaOriginal !== undefined ? { notaOriginal: externo.notaOriginal } : {}),
    ...(externo?.escala !== undefined ? { escala: externo.escala } : {}),
  };
}
