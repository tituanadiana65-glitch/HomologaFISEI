const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

// La materia equivalente es la de la carrera de destino con el mismo nombre
export function buscarEquivalente<T extends { nombre: string }>(nombre: string, candidatas: T[]): T | undefined {
  return candidatas.find((c) => normalizar(c.nombre) === normalizar(nombre));
}
