// Cédula o pasaporte del estudiante (observación del 24/11/2026: dos estudiantes pueden llamarse igual).
// Misma validación que ms-solicitudes, para avisar antes de enviar.
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

export const limpiarDocumento = (t: string) => t.replace(/[\s-]/g, '').toUpperCase();

// "C.I. 1801234566" o "Pasaporte AB12345"; vacío para solicitudes antiguas sin documento
export function textoDocumento(s: { documento?: string | null; tipoDocumento?: string | null }): string {
  if (!s.documento) return '';
  return `${s.tipoDocumento === 'PASAPORTE' ? 'Pasaporte' : 'C.I.'} ${s.documento}`;
}
