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
  // El sílabo es opcional (observación del 24/11/2026): sin él, el agente compara por el nombre contra la matriz de la carrera
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

// T45 · RN-08: requisitos para cambiarse desde otra universidad (Instructivo de cambios de carrera, sección E)
export interface Requisitos {
  cumple: boolean;
  causas: { requisito: string; cumple: boolean; causa: string }[];
}

// RN-08 · Cuántas materias de la nueva carrera se le reconocen: varias aprobadas juntas cuentan como una (HU-26)
export function materiasHomologables(materias: { resultado?: string | null; codigoNueva?: string | null }[]): number {
  const nuevas = new Set<string>();
  let sinCodigo = 0;
  for (const m of materias) {
    if (m.resultado !== 'Homologable') continue;
    if (m.codigoNueva) nuevas.add(m.codigoNueva);
    else sinCodigo++;
  }
  return nuevas.size + sinCodigo;
}

export function revisarRequisitos(
  s: { periodosAprobados?: number | null; documentosLegalizados?: boolean | null },
  materias: { resultado?: string | null; codigoNueva?: string | null }[],
): Requisitos {
  const periodos = s.periodosAprobados ?? 0;
  const homologables = materiasHomologables(materias);
  const legalizados = s.documentosLegalizados === true;
  const plural = (n: number, una: string, varias: string) => `${n} ${n === 1 ? una : varias}`;
  const causas = [
    {
      requisito: 'Periodos aprobados',
      cumple: periodos >= 2,
      causa: `Tiene ${plural(periodos, 'periodo aprobado', 'periodos aprobados')} (mínimo 2)`,
    },
    {
      requisito: 'Materias homologables',
      cumple: homologables >= 2,
      causa: `Tiene ${plural(homologables, 'materia homologable', 'materias homologables')} (mínimo 2)`,
    },
    {
      requisito: 'Documentos legalizados',
      cumple: legalizados,
      causa: legalizados ? 'Indicó que su malla y su récord están legalizados' : 'Falta legalizar la malla y el récord académico',
    },
  ];
  return { cumple: causas.every((c) => c.cumple), causas };
}

// Cédula o pasaporte del estudiante (observación del 24/11/2026: dos estudiantes pueden llamarse igual)
export type TipoDocumento = 'CEDULA' | 'PASAPORTE';

// Cédula ecuatoriana: 10 dígitos, provincia 01-24 (o 30, ecuatorianos en el exterior), tercer dígito menor a 6 y dígito verificador (módulo 10)
export function cedulaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (Number(cedula[2]) >= 6) return false;
  const suma = [...cedula.slice(0, 9)].reduce((s, c, i) => {
    let n = Number(c) * (i % 2 === 0 ? 2 : 1);
    if (n > 9) n -= 9;
    return s + n;
  }, 0);
  return (10 - (suma % 10)) % 10 === Number(cedula[9]);
}

// Devuelve el documento limpio o el error para mostrar
export function validarDocumento(tipo: unknown, documento: unknown): { tipo: TipoDocumento; documento: string } | { error: string } {
  const t: TipoDocumento = tipo === 'PASAPORTE' ? 'PASAPORTE' : 'CEDULA';
  const d = String(documento ?? '').replace(/[\s-]/g, '').toUpperCase();
  if (!d) return { error: t === 'CEDULA' ? 'Escribe la cédula del estudiante' : 'Escribe el pasaporte del estudiante' };
  if (t === 'CEDULA' && !cedulaValida(d)) return { error: 'La cédula no es válida: revisa que tenga los 10 dígitos correctos' };
  if (t === 'PASAPORTE' && !/^[A-Z0-9]{5,20}$/.test(d)) return { error: 'El pasaporte debe tener de 5 a 20 letras o números' };
  return { tipo: t, documento: d };
}
