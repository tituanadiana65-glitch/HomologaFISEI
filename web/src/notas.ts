export interface ConNota { nota: number; notaOriginal?: number | null; escala?: number | null }

// 16 → "16" · 8 → "8,0" (formato de Ecuador, con coma)
export const numero = (n: number, decimales = 0) =>
  n.toLocaleString('es-EC', { minimumFractionDigits: decimales, maximumFractionDigits: 2 });

// "16 / 20 → 8,0 / 10" (solo materias de otra universidad)
export function notaConvertida(m: ConNota): string | null {
  if (m.notaOriginal == null || !m.escala) return null;
  return `${numero(m.notaOriginal)} / ${m.escala} → ${numero(m.nota, 1)} / 10`;
}