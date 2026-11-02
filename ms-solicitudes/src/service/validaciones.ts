// Reglas de negocio de la solicitud (HU-04). Funciones puras: se prueban sin base de datos.
export interface NuevaSolicitud {
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
}

// Devuelve el motivo del rechazo, o null si la solicitud es válida.
export function validarSolicitud(d: Partial<NuevaSolicitud> | undefined, abiertas: number): string | null {
  if (!d?.carreraOrigen || !d.carreraDestino || !d.periodo) {
    return 'Elige la carrera de origen, la de destino y el periodo';
  }
  if (d.carreraOrigen === d.carreraDestino) return 'La carrera de destino debe ser distinta a la de origen';
  if (abiertas > 0) return 'Ya tienes una solicitud abierta';
  return null;
}

// Materia aprobada que el estudiante registra en su solicitud (HU-05)
export interface NuevaMateria {
  codigo: string;
  nivel: string;
  paralelo: string;
  docente: string;
  periodo: string;
  anio: number;
  nota: number;
  matricula: number;
}

// Devuelve el motivo del rechazo, o null si la materia es válida.
export function validarMateria(m: Partial<NuevaMateria> | undefined, yaRegistradas: string[], anioActual = new Date().getFullYear()): string | null {
  if (!m?.codigo || !m.nivel || !m.paralelo || !m.docente || !m.periodo) {
    return 'Completa la materia, el nivel, el paralelo, el docente y el periodo';
  }
  if (typeof m.nota !== 'number' || m.nota < 0 || m.nota > 10) return 'La nota debe estar entre 0 y 10';
  if (![1, 2, 3].includes(m.matricula ?? 0)) return 'La matrícula debe ser 1, 2 o 3';
  if (!Number.isInteger(m.anio) || (m.anio ?? 0) < 1990 || (m.anio ?? 0) > anioActual) return 'Revisa el año de aprobación';
  if (yaRegistradas.includes(m.codigo)) return 'Esa materia ya está registrada en la solicitud';
  return null;
}
