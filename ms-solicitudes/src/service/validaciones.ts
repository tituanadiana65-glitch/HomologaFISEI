import { ESCALAS, codigoExterno } from './notas';

// Reglas de negocio de la solicitud (HU-04 y HU-16). Funciones puras: se prueban sin base de datos.
export type TipoSolicitud = 'INTERNO' | 'EXTERNO';

export interface NuevaSolicitud {
  tipo?: TipoSolicitud; // sin tipo = INTERNO, como en el Sprint 2
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
  // Solo para EXTERNO (estudiante de otra universidad)
  universidadOrigen?: string;
  periodosAprobados?: number;
  documentosLegalizados?: boolean;
  mallaId?: number;
  recordId?: number;
}

// Devuelve el motivo del rechazo, o null si la solicitud es válida.
export function validarSolicitud(d: Partial<NuevaSolicitud> | undefined, abiertas: number): string | null {
  const tipo = d?.tipo ?? 'INTERNO';
  if (tipo !== 'INTERNO' && tipo !== 'EXTERNO') return 'El tipo de solicitud debe ser INTERNO o EXTERNO';
  if (!d?.carreraOrigen?.trim() || !d.carreraDestino || !d.periodo) {
    return 'Elige la carrera de origen, la de destino y el periodo';
  }
  if (tipo === 'EXTERNO') {
    if (!d.universidadOrigen?.trim()) return 'Escribe la universidad de la que vienes';
    const p = d.periodosAprobados;
    if (typeof p !== 'number' || !Number.isInteger(p) || p < 1 || p > 12) return 'Indica cuántos periodos aprobaste (de 1 a 12)';
  } else if (d.carreraOrigen === d.carreraDestino) {
    return 'La carrera de destino debe ser distinta a la de origen';
  }
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

// T38 · Materia de otra universidad (HU-16)
export interface NuevaMateriaExterna {
  nombre: string;
  creditos: number;
  horas: number;
  nota: number; // como la puso su universidad
  escala: number; // 10, 20 o 100
  anio: number;
  silaboId?: number;
}

const entero = (n: unknown) => typeof n === 'number' && Number.isInteger(n);

// Devuelve el motivo del rechazo, o null si la materia es válida. yaRegistradas: códigos EXT- de la solicitud.
export function validarMateriaExterna(
  m: Partial<NuevaMateriaExterna> | undefined,
  yaRegistradas: string[],
  anioActual = new Date().getFullYear(),
): string | null {
  if (!m?.nombre?.trim()) return 'Escribe el nombre de la materia';
  if (!entero(m.creditos) || m.creditos! <= 0 || m.creditos! > 20) return 'Los créditos deben ser un número entero entre 1 y 20';
  if (!entero(m.horas) || m.horas! <= 0 || m.horas! > 1000) return 'Las horas deben ser un número entero entre 1 y 1000';
  if (!ESCALAS.includes(m.escala as never)) return 'La nota debe ser sobre 10, sobre 20 o sobre 100';
  if (typeof m.nota !== 'number' || m.nota < 0 || m.nota > m.escala!) return `La nota debe estar entre 0 y ${m.escala}`;
  if (!entero(m.anio) || m.anio! < 1990 || m.anio! > anioActual) return 'Revisa el año de aprobación';
  if (m.silaboId !== undefined && m.silaboId !== null && (!entero(m.silaboId) || m.silaboId <= 0)) return 'El sílabo no es válido; vuelve a subirlo';
  if (yaRegistradas.includes(codigoExterno(m.nombre))) return 'Esa materia ya está registrada en la solicitud';
  return null;
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
