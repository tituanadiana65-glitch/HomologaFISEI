import type { Causa, Comparacion, Informe, MateriaCatalogo, Resultado, ResultadoReglas } from '../dto/tipos';

// T12 · Une la decisión del agente (contenidos, RN-01) con la del motor de reglas (RN-02 a RN-05).
export function armarInforme(
  aprobada: MateriaCatalogo,
  nueva: MateriaCatalogo,
  contenidos: Comparacion,
  reglas: ResultadoReglas,
  minimo = 80,
): Informe {
  const rn01: Causa = {
    regla: 'RN-01',
    cumple: contenidos.cumple,
    causa: contenidos.disponible
      ? `Contenidos ${contenidos.porcentaje} % (mínimo ${minimo} %). ${contenidos.explicacion}`.trim()
      : contenidos.explicacion,
  };
  const causas = [rn01, ...reglas.reglas];
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
  };
}
