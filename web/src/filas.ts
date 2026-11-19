// HU-26 y HU-29 · Filas del resultado: una por cada materia nueva que se evalúa.
// Dos materias aprobadas juntas (Física I + Física II → Física) van en una sola fila;
// una materia aprobada que cubre dos nuevas (Física → Física I y Física II) tiene una fila por cada una.
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
  adicionales?: string | null;
}

export interface Fila<M extends MateriaConResultado = MateriaConResultado> {
  clave: string;
  materias: M[]; // materias aprobadas de la fila (2 o más si se evaluaron juntas)
  codigoNueva: string | null;
  resultado: string | null;
  informe: string | null;
  tambien: boolean; // HU-29: otra materia nueva que cubre la misma materia aprobada
}

interface Adicional {
  codigoNueva: string;
  resultado: string;
  informe: unknown;
}

const leerAdicionales = (texto?: string | null): Adicional[] => {
  try {
    const lista = texto ? (JSON.parse(texto) as unknown) : [];
    return Array.isArray(lista) ? (lista as Adicional[]) : [];
  } catch {
    return [];
  }
};

export function armarFilas<M extends MateriaConResultado>(materias: M[]): Fila<M>[] {
  const filas: Fila<M>[] = [];
  const usadas = new Set<string>();
  for (const m of materias) {
    if (usadas.has(m.codigo)) continue;
    const otras = (m.juntoCon ?? '').split(',').filter(Boolean);
    const grupo = [m, ...materias.filter(x => x !== m && otras.includes(x.codigo))];
    grupo.forEach(x => usadas.add(x.codigo));
    filas.push({ clave: m.codigo, materias: grupo, codigoNueva: m.codigoNueva, resultado: m.resultado, informe: m.informe, tambien: false });
    for (const a of leerAdicionales(m.adicionales)) {
      filas.push({
        clave: `${m.codigo}>${a.codigoNueva}`,
        materias: [m],
        codigoNueva: a.codigoNueva,
        resultado: a.resultado,
        informe: a.informe ? JSON.stringify(a.informe) : null,
        tambien: true,
      });
    }
  }
  return filas;
}
