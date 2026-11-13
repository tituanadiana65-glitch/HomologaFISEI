import PDFDocument from 'pdfkit';

export const SILABO =
  'Sílabo de Cálculo II. Unidad 1: integrales definidas e indefinidas. Unidad 2: técnicas de integración por partes y por sustitución. ' +
  'Unidad 3: aplicaciones de la integral al cálculo de áreas y volúmenes. Unidad 4: sucesiones y series numéricas. Bibliografía: Stewart, Cálculo.';

export function pdfConTexto(texto: string): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.text(texto);
    doc.end();
  });
}
