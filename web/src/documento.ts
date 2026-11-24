// Cédula o pasaporte del estudiante (observación del 24/11/2026: dos estudiantes pueden llamarse igual).
// Misma validación que ms-solicitudes, para avisar antes de enviar.
// Cualquier cédula de 10 números (no se revisa el dígito verificador)
export function cedulaValida(cedula: string): boolean {
  return /^\d{10}$/.test(cedula);
}

export const limpiarDocumento = (t: string) => t.replace(/[\s-]/g, '').toUpperCase();

// "C.I. 1801234566" o "Pasaporte AB12345"; vacío para solicitudes antiguas sin documento
export function textoDocumento(s: { documento?: string | null; tipoDocumento?: string | null }): string {
  if (!s.documento) return '';
  return `${s.tipoDocumento === 'PASAPORTE' ? 'Pasaporte' : 'C.I.'} ${s.documento}`;
}
