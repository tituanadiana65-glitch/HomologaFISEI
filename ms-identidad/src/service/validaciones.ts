export interface Registro {
  nombre: string;
  correo: string;
  clave: string;
}

export function validarRegistro(d: Partial<Registro>): string | null {
  if (!d.nombre?.trim()) return 'Escribe tu nombre';
  if (!/^[^@\s]+@uta\.edu\.ec$/i.test(d.correo?.trim() ?? '')) return 'Usa tu correo institucional @uta.edu.ec';
  if ((d.clave ?? '').length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  return null;
}