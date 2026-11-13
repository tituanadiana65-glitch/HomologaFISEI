// T41 · Notas de otra universidad (HU-24, CAU-P-122-2026 art. 19). Funciones puras.

// Escalas que se aceptan: sobre 10 (UTA), sobre 20 y sobre 100
export const ESCALAS = [10, 20, 100] as const;

// Pasa la nota a la escala sobre 10 de la UTA, de forma proporcional: 16/20 → 8; 85/100 → 8,5
export function convertirNota(nota: number, escala: number): number {
  return Math.round(((nota * 10) / escala) * 100) / 100;
}

// Código para una materia de otra universidad, armado con su nombre: «Cálculo II» → «EXT-CALCULO-II»
export function codigoExterno(nombre: string): string {
  const base = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `EXT-${base}`;
}
