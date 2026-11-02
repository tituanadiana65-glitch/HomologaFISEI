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
