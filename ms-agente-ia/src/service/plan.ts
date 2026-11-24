// Lectura de un plan analítico con IA cuando no tiene el formato de la FISEI (observación del 24/11/2026):
// lo convierte en una fila de la matriz de la carrera (materia, nivel, unidades, créditos, horas).
import { limpiarJson } from './agente.service';

export const SISTEMA_PLAN = `Eres un asistente de la Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI) de la Universidad Técnica de Ambato.
Te doy el texto de un plan analítico (o sílabo) de UNA materia. Saca sus datos.
Reglas:
- Copia el nombre de la materia tal como aparece. No inventes datos: si un dato no aparece, pon null.
- "nivel": el semestre en palabras (PRIMERO, SEGUNDO, ...).
- "unidades": cada unidad o capítulo con sus temas resumidos en una sola línea, y sus horas si aparecen.
Responde SOLO con un objeto JSON, sin texto antes ni después:
{"codigo": "texto" o null, "nombre": "texto", "nivel": "texto" o null, "creditos": número o null, "horasTotales": número o null, "objetivoGeneral": "texto" o null, "unidades": [{"contenido": "texto", "horas": número o null}]}`;

export const MAX_PLAN = 20_000;
export const armarPedidoPlan = (texto: string) => `PLAN ANALÍTICO:\n${texto.length > MAX_PLAN ? `${texto.slice(0, MAX_PLAN)}…` : texto}`;

export interface PlanLeido {
  codigo: string | null;
  nombre: string;
  nivel: string | null;
  creditos: number | null;
  horasTotales: number | null;
  objetivoGeneral: string | null;
  unidades: { contenido: string; horas: number | null }[];
}

const num = (v: unknown) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function leerPlanIA(respuesta: string): PlanLeido {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(limpiarJson(respuesta)) as Record<string, unknown>;
  } catch {
    throw new Error('La IA no devolvió el plan en el formato esperado');
  }
  const nombre = txt(j.nombre);
  if (!nombre) throw new Error('La IA no encontró el nombre de la materia');
  const unidades = (Array.isArray(j.unidades) ? j.unidades : [])
    .map((u: { contenido?: unknown; horas?: unknown }) => ({ contenido: txt(u?.contenido) ?? '', horas: num(u?.horas) }))
    .filter((u) => u.contenido);
  return {
    codigo: txt(j.codigo),
    nombre,
    nivel: txt(j.nivel)?.toUpperCase() ?? null,
    creditos: num(j.creditos),
    horasTotales: num(j.horasTotales),
    objetivoGeneral: txt(j.objetivoGeneral),
    unidades,
  };
}
