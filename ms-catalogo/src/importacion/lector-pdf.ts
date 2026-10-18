import { readFile } from 'node:fs/promises';
import { extractText, getDocumentProxy } from 'unpdf';

export interface PlanAnaliticoLeido {
  carrera: 'TI' | 'SW';
  codigo: string;
  nombre: string;
  nivel: string;
  creditos: number;
  horasTotales: number;
  unidadOrganizacional: string;
  periodo: string;
  docente: string;
  objetivoGeneral: string;
  unidades: { numero: number; horas: number; contenido: string }[];
  requisitos: { tipo: 'PRE' | 'CO'; codigo: string; nombre: string }[];
}

export async function leerTextoPdf(ruta: string): Promise<string> {
  const buffer = await readFile(ruta);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text;
}

export function buscarNumero(texto: string, etiqueta: string): number | null {
  const m = texto.match(new RegExp(`${etiqueta}\\s*:?\\s*(\\d+)`, 'i'));
  return m ? Number(m[1]) : null;
}

export function validarPlan(plan: Partial<PlanAnaliticoLeido>): string[] {
  const faltan: string[] = [];
  if (!plan.codigo) faltan.push('código');
  if (!plan.creditos) faltan.push('créditos');
  if (!plan.horasTotales) faltan.push('horas');
  if (!plan.unidades || plan.unidades.length === 0) faltan.push('unidades');
  return faltan;
}
export function buscarTexto(texto: string, etiqueta: string): string | null {
  const m = texto.match(new RegExp(`${etiqueta}\\s*:\\s*([^\\n]+)`, 'i'));
  return m ? m[1].trim() : null;
}

export function buscarUnidades(texto: string): PlanAnaliticoLeido['unidades'] {
  const patron = /Unidad\s+(\d+)\s*\((\d+)\s*horas\)\s*:\s*([^\n]+)/gi;
  return [...texto.matchAll(patron)].map((m) => ({
    numero: Number(m[1]),
    horas: Number(m[2]),
    contenido: m[3].trim(),
  }));
}

export function buscarRequisitos(texto: string): PlanAnaliticoLeido['requisitos'] {
  const patron = /(Prerrequisito|Correquisito)\s*:\s*(\S+)\s+([^\n]+)/gi;
  return [...texto.matchAll(patron)].map((m) => ({
    tipo: m[1].toLowerCase().startsWith('pre') ? ('PRE' as const) : ('CO' as const),
    codigo: m[2],
    nombre: m[3].trim(),
  }));
}

export function armarPlan(texto: string): Partial<PlanAnaliticoLeido> {
  const codigo = buscarTexto(texto, 'Código') ?? undefined;
  const sigla = codigo?.split('-')[2];
  return {
    carrera: sigla === 'TI' || sigla === 'SW' ? sigla : undefined,
    codigo,
    nombre: buscarTexto(texto, 'Asignatura') ?? undefined,
    nivel: buscarTexto(texto, 'Nivel') ?? undefined,
    creditos: buscarNumero(texto, 'Créditos') ?? undefined,
    horasTotales: buscarNumero(texto, 'Horas totales') ?? undefined,
    unidadOrganizacional: buscarTexto(texto, 'Unidad organizacional') ?? undefined,
    periodo: buscarTexto(texto, 'Período') ?? undefined,
    docente: buscarTexto(texto, 'Docente') ?? undefined,
    objetivoGeneral: buscarTexto(texto, 'Objetivo general') ?? undefined,
    unidades: buscarUnidades(texto),
    requisitos: buscarRequisitos(texto),
  };
}