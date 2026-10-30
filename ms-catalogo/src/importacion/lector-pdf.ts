// T06 · Lector de planes analíticos de la FISEI (probado con los 80 planes de TI y Software).
import type { PlanAnalitico, Requisito, Unidad } from '../dto/plan-analitico.dto';

// pdf-parse 1.1.1 no trae tipos; se carga su archivo interno para evitar el modo de prueba de su index.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse/lib/pdf-parse.js') as (b: Buffer) => Promise<{ text: string }>;

const COD = /UTA-FISEI-[A-Z]+-[A-Z]+-[A-Z]+-\d{2}-\d{2}/;
const limpiar = (t: string) => t.replace(/P[áa]gina \d+\/\d+/g, ' ').replace(/\s+/g, ' ').trim();
const tomar = (t: string, re: RegExp) => (t.match(re)?.[1] ?? '').trim();

function requisitos(bloque: string): Requisito[] {
  return bloque.split('\n')
    .map((l) => l.trim().match(new RegExp(`^(.+?)(${COD.source})$`)))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ nombre: m[1].trim(), codigo: m[2] }));
}

export interface Candidato { valor: number; inicio: number; fin: number; }

// Las horas de cada unidad van pegadas al resultado de aprendizaje, que empieza con mayúscula:
// "...curva\n24Aplica", "...privilegios36Administra", "...de TI36Ejecuta", "...htaml539Desarrolla" (39).
// Se toman todos los números posibles y luego se elige la combinación que suma las horas totales.
export function candidatosHoras(texto: string): Candidato[] {
  const out: Candidato[] = [];
  for (const m of texto.matchAll(/\d+(?=:?\s?[A-ZÁÉÍÓÚÑ])/g)) {
    const run = m[0];
    for (let k = 0; k < run.length; k++) {
      const s = run.slice(k);
      const valor = parseInt(s, 10);
      if (s[0] !== '0' && valor >= 4 && valor <= 400) out.push({ valor, inicio: m.index + k, fin: m.index + run.length });
    }
  }
  return out;
}

export function elegirHoras(cands: Candidato[][], total: number): (Candidato | undefined)[] {
  const elegido: (Candidato | undefined)[] = [];
  const buscar = (i: number, suma: number): boolean => {
    if (i === cands.length) return suma === total;
    for (const c of cands[i]) {
      elegido[i] = c;
      if (buscar(i + 1, suma + c.valor)) return true;
    }
    return false;
  };
  if (total > 0 && cands.every((c) => c.length > 0) && buscar(0, 0)) return elegido;
  return cands.map((c) => c[0]); // si no cuadra, el primero de cada unidad
}

export function interpretar(texto: string): PlanAnalitico {
  const t = texto.replace(/\r/g, '');
  const pre = tomar(t, /PRERREQUISITOS([\s\S]*?)Unidad organizacional/);
  const cor = tomar(t, /CORREQUISITOS([\s\S]*?)CARGA HORARIA/);
  const horasTotales = parseInt(tomar(t, /TOTAL DE HORAS AL SEMESTRE[\s\S]*?semestral\)\s*\n\s*(\d+)/) || '0', 10);
  const contenido = tomar(t, /III CONTENIDO([\s\S]*?)(?:Resultados del aprendizaje de la asignatura|Total de horas|IV METODOLOG)/);
  const partes = contenido.split(/U\.(?=\d)/).slice(1).map((p) => ({ numero: parseInt(p, 10), texto: p.replace(/^\d+/, '') }));
  const horas = elegirHoras(partes.map((p) => candidatosHoras(p.texto)), horasTotales);
  const unidades: Unidad[] = partes.map((p, i) => {
    const h = horas[i];
    const sinHoras = h ? `${p.texto.slice(0, h.inicio)} ${p.texto.slice(h.fin)}` : p.texto;
    return { numero: p.numero, horas: h?.valor ?? 0, contenido: limpiar(sinHoras) };
  });
  return {
    codigo: tomar(t, new RegExp(`Código\\s*(${COD.source})`)),
    nombre: tomar(t, /Nombre de la asignatura\s*\n(.+)/),
    carrera: tomar(t, /\nCarrera\s*\n(.+)/),
    nivel: tomar(t, /\nNivel\s*\n\s*(.+)/),
    periodo: tomar(t, /\n\s*([A-Z]+ \d{4} - [A-Z]+ \d{4})/),
    docente: tomar(t, /[A-Z]+ \d{4} - [A-Z]+ \d{4}\s*\n(.+)/),
    unidadOrganizacional: tomar(t, /Unidad organizacional curricular\s*\n(.+)/),
    creditos: parseInt(tomar(t, /Créditos\/Horas\s*\n\s*(\d+)/) || '0', 10),
    horasTotales,
    prerrequisitos: requisitos(pre),
    correquisitos: requisitos(cor),
    objetivoGeneral: limpiar(tomar(t, /Objetivo general de la asignatura\s*\n([\s\S]*?)Objetivos espec/)),
    unidades,
  };
}

export async function leerPlan(buffer: Buffer): Promise<PlanAnalitico> {
  const datos = await pdf(buffer);
  return interpretar(datos.text);
}

// Siglas del código del plan -> código de carrera en catalogo_db.
const SIGLAS: Record<string, string> = { TI: 'TI', SF: 'SW', SW: 'SW' };

export function carreraDesdeCodigo(codigo: string): string | undefined {
  return SIGLAS[codigo.split('-')[2] ?? ''];
}

// Devuelve lo que falta para considerar el archivo un plan analítico válido.
export function validarPlan(plan: Partial<PlanAnalitico>): string[] {
  const faltan: string[] = [];
  if (!plan.codigo) faltan.push('código');
  if (!plan.creditos) faltan.push('créditos');
  if (!plan.horasTotales) faltan.push('horas');
  if (!plan.unidades || plan.unidades.length === 0) faltan.push('unidades');
  return faltan;
}
