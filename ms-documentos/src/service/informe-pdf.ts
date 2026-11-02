import PDFDocument from 'pdfkit';

export interface MateriaInforme {
  codigo: string;
  nombre: string;
  nota: number;
  resultado: string | null;
  codigoNueva: string | null;
  informe: string | null;
}

export interface SolicitudInforme {
  id: number;
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
  materias: MateriaInforme[];
}

interface Causa {
  regla: string;
  cumple: boolean;
  causa: string;
}
interface Informe {
  nueva?: string;
  causas?: Causa[];
  temasFaltan?: string[];
}

export function crearPdf(
  s: SolicitudInforme,
  estudiante: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    doc
      .fontSize(9)
      .text('UNIVERSIDAD TÉCNICA DE AMBATO · FISEI', { align: 'center' });
    doc
      .moveDown(0.5)
      .fontSize(16)
      .text('Informe de homologación', { align: 'center' });
    doc
      .moveDown()
      .fontSize(10)
      .text(`Estudiante: ${estudiante}`)
      .text(
        `Solicitud ${s.id}: de ${s.carreraOrigen} a ${s.carreraDestino} · Periodo ${s.periodo}`,
      )
      .text(`Fecha: ${new Date().toLocaleDateString('es-EC')}`);

    for (const m of s.materias) {
      const inf = m.informe ? (JSON.parse(m.informe) as Informe) : null;
      doc
        .moveDown()
        .fontSize(12)
        .text(`${m.nombre} (nota ${m.nota})`, { underline: true });
      doc
        .fontSize(10)
        .text(
          `Resultado: ${m.resultado ?? 'Sin resultado'}${inf?.nueva ? ` · frente a ${inf.nueva}` : ''}`,
        );
      for (const c of inf?.causas ?? []) {
        doc.text(
          `${c.cumple ? 'Cumple' : 'No cumple'} · ${c.regla}: ${c.causa}`,
        );
      }
      if (inf?.temasFaltan?.length)
        doc.text(`Temas que faltan: ${inf.temasFaltan.join(', ')}`);
    }

    doc
      .moveDown(2)
      .fontSize(8)
      .fillColor('gray')
      .text(
        'Este informe es un análisis de apoyo. La homologación oficial la resuelve el Consejo Directivo de la Facultad (Resolución CAU-P-122-2026, art. 15).',
      );
    doc.end();
  });
}
