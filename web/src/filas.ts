// HU-26 · Filas del resultado: una por cada materia nueva evaluada.
// Varias materias aprobadas juntas (Física I + Física II → Física) van en una sola fila.
export interface MateriaConResultado {
  codigo: string;
  nombre: string;
  nota: number;
  notaOriginal?: number | null;
  escala?: number | null;
  codigoNueva: string | null;
  resultado: string | null;
  informe: string | null;
  juntoCon?: string | null;
  // Revisión docente
  resultadoDocente?: string | null;
  comentarioDocente?: string | null;
  docenteCambio?: string | null;
  nuevaDocente?: string | null;
}

export interface Fila<M extends MateriaConResultado = MateriaConResultado> {
  clave: string;
  materias: M[]; // materias aprobadas de la fila (2 o más si se evaluaron juntas)
  codigoNueva: string | null;
  resultado: string | null; // el que vale: el del docente si lo cambió
  resultadoAgente: string | null;
  comentarioDocente?: string | null;
  docenteCambio?: string | null;
  nuevaDocente?: string | null; // materia nueva elegida por el docente
  informe: string | null;
}

export function armarFilas<M extends MateriaConResultado>(materias: M[]): Fila<M>[] {
  const filas: Fila<M>[] = [];
  const usadas = new Set<string>();
  for (const m of materias) {
    if (usadas.has(m.codigo)) continue;
    const otras = (m.juntoCon ?? '').split(',').filter(Boolean);
    const grupo = [m, ...materias.filter(x => x !== m && otras.includes(x.codigo))];
    grupo.forEach(x => usadas.add(x.codigo));
    filas.push({
      clave: m.codigo,
      materias: grupo,
      codigoNueva: m.codigoNueva,
      resultado: m.resultadoDocente ?? m.resultado,
      resultadoAgente: m.resultado,
      comentarioDocente: m.comentarioDocente,
      docenteCambio: m.docenteCambio,
      nuevaDocente: m.nuevaDocente,
      informe: m.informe,
    });
  }
  return filas;
}
