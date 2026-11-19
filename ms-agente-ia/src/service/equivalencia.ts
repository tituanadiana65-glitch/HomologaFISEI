export const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// La materia equivalente es la de la carrera de destino con el mismo nombre
export function buscarEquivalente<T extends { nombre: string }>(nombre: string, candidatas: T[]): T | undefined {
  return candidatas.find((c) => normalizar(c.nombre) === normalizar(nombre));
}

// HU-26 / HU-29 · "FÍSICA II" → "FISICA"; "Cálculo 1" → "CALCULO". Un nombre sin número queda igual.
const NUMERO = /\s+(I{1,3}|IV|VI{0,3}|IX|V|[1-9])$/;
export const tieneNumero = (nombre: string) => NUMERO.test(normalizar(nombre));
export const nombreBase = (nombre: string) => normalizar(nombre).replace(NUMERO, '').trim();

export interface PorNombre<T> {
  exacta?: T; // mismo nombre: una con una, como siempre
  partes: T[]; // HU-29: "Física" cubre "Física I" y "Física II" de la carrera de destino
  base?: T; // HU-26: "Física I" es una parte de "Física" de la carrera de destino
}

// Busca por nombre la materia (o materias) de la carrera de destino que corresponden a una materia aprobada
export function buscarPorNombre<T extends { nombre: string }>(nombre: string, candidatas: T[]): PorNombre<T> {
  const exacta = buscarEquivalente(nombre, candidatas);
  if (exacta) return { exacta, partes: [] };
  const partes = candidatas
    .filter((c) => tieneNumero(c.nombre) && nombreBase(c.nombre) === normalizar(nombre))
    .sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre)));
  const base = tieneNumero(nombre) ? candidatas.find((c) => normalizar(c.nombre) === nombreBase(nombre)) : undefined;
  return { partes, base };
}
