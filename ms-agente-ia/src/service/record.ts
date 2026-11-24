// Lectura del récord académico con IA (observación del docente 22/11/2026: "tener la malla, no estar metiendo todo a mano";
// "récord académico donde está lo que ha cursado, aprobado, reprobado"). Funciones puras: instrucciones y lectura de la respuesta.
import { limpiarJson } from './agente.service';
import { normalizar } from './equivalencia';

export const SISTEMA_RECORD = `Eres un asistente de la Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI) de la Universidad Técnica de Ambato.
Te doy el texto de un récord académico (historial de notas) de un estudiante. Saca TODAS las materias que aparecen, una por cada vez que la cursó.
Reglas:
- Copia el nombre de la materia tal como aparece. No inventes materias ni datos: si un dato no aparece, pon null.
- "estado": "APROBADA", "REPROBADA" o "CURSANDO", según lo que diga el récord (o, si no lo dice, según la nota y la nota mínima del récord).
- "escala": sobre cuánto se califica (10, 20 o 100).
- "anio": el año en que la cursó (por ejemplo, de "2024-1" sale 2024).
Responde SOLO con un objeto JSON, sin texto antes ni después:
{"materias": [{"nombre": "texto", "creditos": número o null, "horas": número o null, "nota": número o null, "escala": 10, 20, 100 o null, "anio": número o null, "periodo": "texto" o null, "estado": "APROBADA" | "REPROBADA" | "CURSANDO"}]}`;

export const MAX_RECORD = 20_000;

export type Estado = 'APROBADA' | 'REPROBADA' | 'CURSANDO';

export interface MateriaRecord {
  nombre: string;
  creditos: number | null;
  horas: number | null;
  nota: number | null;
  escala: number | null;
  anio: number | null;
  periodo: string | null;
  estado: Estado;
  veces: number; // cuántas veces la cursó (si la reprobó y luego la aprobó, 2)
  // Solo UTA: la materia del catálogo de su carrera de origen
  codigo?: string | null;
  nivel?: string | null;
  docente?: string | null;
}

export const armarPedidoRecord = (texto: string) =>
  `RÉCORD ACADÉMICO:\n${texto.length > MAX_RECORD ? `${texto.slice(0, MAX_RECORD)}…` : texto}`;

const numero = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  return v === null || v === undefined || v === '' || Number.isNaN(n) ? null : n;
};

function leerEstado(v: unknown): Estado | null {
  const t = normalizar(typeof v === 'string' ? v : '');
  if (t.startsWith('REPROB')) return 'REPROBADA';
  if (t.startsWith('APROB') || t.startsWith('CONVALID') || t.startsWith('HOMOLOG')) return 'APROBADA';
  if (t.includes('CURS')) return 'CURSANDO';
  return null;
}

// Si la IA no dice la escala, se deduce de la nota (16 → sobre 20; 85 → sobre 100)
const deducirEscala = (nota: number | null) => (nota === null ? null : nota > 20 ? 100 : nota > 10 ? 20 : 10);
// Nota mínima para aprobar cuando el récord no trae el estado: 7/10, 14/20, 70/100
const aprueba = (nota: number, escala: number) => nota >= escala * 0.7;

// Lee la respuesta de la IA y deja una sola fila por materia: si la reprobó y luego la aprobó, queda la aprobada.
export function leerRecord(respuesta: string): MateriaRecord[] {
  let json: { materias?: unknown };
  try {
    json = JSON.parse(limpiarJson(respuesta)) as { materias?: unknown };
  } catch {
    throw new Error('la IA no devolvió un JSON válido');
  }
  if (!Array.isArray(json.materias)) throw new Error('la respuesta no trae la lista de materias');
  const porNombre = new Map<string, MateriaRecord>();
  for (const bruta of json.materias as Record<string, unknown>[]) {
    const nombre = typeof bruta?.nombre === 'string' ? bruta.nombre.replace(/\s+/g, ' ').trim() : '';
    if (!nombre) continue;
    const nota = numero(bruta.nota);
    const escalaLeida = numero(bruta.escala);
    const escala = escalaLeida && [10, 20, 100].includes(escalaLeida) ? escalaLeida : deducirEscala(nota);
    const anioLeido = numero(bruta.anio);
    const periodo = typeof bruta.periodo === 'string' && bruta.periodo.trim() ? bruta.periodo.trim() : null;
    const anio = anioLeido && anioLeido > 1950 ? Math.trunc(anioLeido) : Number(periodo?.match(/(19|20)\d{2}/)?.[0]) || null;
    const estado = leerEstado(bruta.estado) ?? (nota !== null && escala ? (aprueba(nota, escala) ? 'APROBADA' : 'REPROBADA') : 'CURSANDO');
    const m: MateriaRecord = {
      nombre,
      creditos: numero(bruta.creditos),
      horas: numero(bruta.horas),
      nota,
      escala,
      anio,
      periodo,
      estado,
      veces: 1,
    };
    const clave = normalizar(nombre);
    const antes = porNombre.get(clave);
    if (!antes) {
      porNombre.set(clave, m);
      continue;
    }
    // La misma materia otra vez: gana la aprobada; entre dos iguales, la más reciente
    const gana = (m.estado === 'APROBADA' && antes.estado !== 'APROBADA') || (m.estado === antes.estado && (m.anio ?? 0) >= (antes.anio ?? 0));
    porNombre.set(clave, { ...(gana ? m : antes), veces: antes.veces + 1 });
  }
  return [...porNombre.values()];
}

// UTA · une cada materia del récord con la del catálogo de su carrera de origen (por el nombre)
export function unirConCatalogo<T extends { codigo: string; nombre: string; nivel?: string; docente?: string; creditos?: number; horasTotales?: number }>(
  materias: MateriaRecord[],
  catalogo: T[],
): MateriaRecord[] {
  return materias.map((m) => {
    const c = catalogo.find((x) => normalizar(x.nombre) === normalizar(m.nombre));
    if (!c) return { ...m, codigo: null, nivel: null, docente: null };
    return {
      ...m,
      codigo: c.codigo,
      nivel: c.nivel ?? null,
      docente: c.docente ?? null,
      creditos: m.creditos ?? c.creditos ?? null,
      horas: m.horas ?? c.horasTotales ?? null,
    };
  });
}
