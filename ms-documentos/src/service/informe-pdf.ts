import PDFDocument from 'pdfkit';

export interface MateriaInforme {
  codigo: string;
  nombre: string;
  nota: number;
  resultado: string | null;
  codigoNueva: string | null;
  informe: string | null;
  notaOriginal?: number | null; // T50 · solo EXTERNO: nota como la puso su universidad
  escala?: number | null; // 10, 20 o 100
}

export interface SolicitudInforme {
  id: number;
  tipo?: 'INTERNO' | 'EXTERNO';
  universidadOrigen?: string | null;
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
  requisitos?: string | null; // T45 · revisión de RN-08 (solo EXTERNO)
  materias: MateriaInforme[];
}

// T50 · Requisitos de RN-08 que guarda ms-solicitudes
export interface Requisitos {
  cumple: boolean;
  causas: { requisito: string; cumple: boolean; causa: string }[];
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
  parecido?: number; // T50 · solo EXTERNO
}

const GUINDA = '#8b1c2c';
const GRIS = '#5f6368';
const FONDO = '#f5f6f8';
const COLORES: Record<string, string> = {
  Homologable: '#2e7d32',
  'No homologable': '#c62828',
  Pendiente: '#ef8f00',
  'Sin materia equivalente': '#757575',
};
const colorDe = (resultado: string | null) =>
  COLORES[resultado ?? ''] ?? '#9e9e9e';

const decimal = (n: number) => n.toFixed(1).replace('.', ',');

// T50 · "Nota 16 / 20 (8,0 / 10 en la UTA)" para otra universidad; "Nota 8.5" para la UTA
export function textoNota(m: MateriaInforme): string {
  if (m.notaOriginal != null && m.escala && m.escala !== 10)
    return `Nota ${m.notaOriginal} / ${m.escala} (${decimal(m.nota)} / 10 en la UTA)`;
  return `Nota ${m.nota}`;
}

// T50 · Lee la revisión de RN-08; null si no es EXTERNO o todavía no hay revisión
export function leerRequisitos(s: SolicitudInforme): Requisitos | null {
  if (s.tipo !== 'EXTERNO' || !s.requisitos) return null;
  try {
    return JSON.parse(s.requisitos) as Requisitos;
  } catch {
    return null;
  }
}

export function crearPdf(
  s: SolicitudInforme,
  estudiante: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const partes: Buffer[] = [];
    doc.on('data', (p: Buffer) => partes.push(p));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const izq = 50;
    const ancho = doc.page.width - 100;

    // Encabezado guinda
    doc.rect(0, 0, doc.page.width, 95).fill(GUINDA);
    doc
      .fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text('UNIVERSIDAD TÉCNICA DE AMBATO', izq, 24);
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .text(
        'Facultad de Ingeniería en Sistemas, Electrónica e Industrial',
        izq,
        40,
      );
    doc
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('Informe de homologación', izq, 58);

    // Datos de la solicitud
    const dato = (etiqueta: string, valor: string, x: number, y: number) => {
      doc
        .fillColor(GRIS)
        .font('Helvetica')
        .fontSize(7.5)
        .text(etiqueta.toUpperCase(), x, y, { width: 140 });
      doc
        .fillColor('#111111')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(valor, x, y + 11, { width: 140 });
    };
    // T50 · el nombre de otra universidad ocupa más líneas: la casilla crece y todo baja
    const extra = s.tipo === 'EXTERNO' ? 16 : 0;
    doc.roundedRect(izq, 115, ancho, 80 + extra, 6).fill(FONDO);
    dato('Estudiante', estudiante, izq + 15, 127);
    dato('Solicitud', `N.º ${s.id}`, izq + 185, 127);
    dato('Fecha', new Date().toLocaleDateString('es-EC'), izq + 340, 127);
    const externo = s.tipo === 'EXTERNO';
    dato(
      externo ? 'Universidad de origen' : 'Carrera de origen',
      externo
        ? `${s.universidadOrigen ?? 'Otra universidad'} · ${s.carreraOrigen}`
        : s.carreraOrigen,
      izq + 15,
      160,
    );
    dato('Carrera de destino', s.carreraDestino, izq + 185, 160);
    dato('Periodo', s.periodo, izq + 340, 160);

    // Resumen: cuántas materias hay de cada resultado
    doc
      .fillColor(GUINDA)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('Resumen', izq, 215 + extra);
    const anchoCaja = (ancho - 30) / 4;
    Object.keys(COLORES).forEach((tipo, i) => {
      const x = izq + i * (anchoCaja + 10);
      const total = s.materias.filter((m) => m.resultado === tipo).length;
      doc.roundedRect(x, 237 + extra, anchoCaja, 54, 6).fill(FONDO);
      doc.rect(x, 237 + extra, 4, 54).fill(COLORES[tipo]);
      doc
        .fillColor(COLORES[tipo])
        .font('Helvetica-Bold')
        .fontSize(20)
        .text(String(total), x + 14, 244 + extra);
      doc
        .fillColor(GRIS)
        .font('Helvetica')
        .fontSize(8)
        .text(tipo, x + 14, 270 + extra, { width: anchoCaja - 20 });
    });

    // T50 · Requisitos para cambiarse desde otra universidad (RN-08)
    let yDetalle = 312 + extra;
    const requisitos = leerRequisitos(s);
    if (requisitos) {
      const colorReq = requisitos.cumple
        ? COLORES.Homologable
        : COLORES['No homologable'];
      const alto = 34 + requisitos.causas.length * 15;
      doc.roundedRect(izq, 308 + extra, ancho, alto, 6).fill(FONDO);
      doc.rect(izq, 308 + extra, 4, alto).fill(colorReq);
      doc
        .fillColor(colorReq)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(
          requisitos.cumple
            ? 'Cumple los requisitos para cambiarse desde otra universidad (RN-08)'
            : 'No cumple los requisitos para cambiarse desde otra universidad (RN-08)',
          izq + 15,
          318 + extra,
          { width: ancho - 30 },
        );
      requisitos.causas.forEach((c, i) => {
        const y = 336 + extra + i * 15;
        doc
          .circle(izq + 19, y + 4, 2.5)
          .fill(c.cumple ? COLORES.Homologable : COLORES['No homologable']);
        doc
          .fillColor('#333333')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(`${c.requisito}: `, izq + 27, y, {
            continued: true,
            width: ancho - 40,
          })
          .font('Helvetica')
          .text(`${c.cumple ? 'Cumple' : 'No cumple'} · ${c.causa}`);
      });
      yDetalle = 308 + extra + alto + 20;
    }

    // Detalle por materia
    doc
      .fillColor(GUINDA)
      .font('Helvetica-Bold')
      .fontSize(13)
      .text('Detalle por materia', izq, yDetalle);
    doc.y = yDetalle + 26;

    for (const m of s.materias) {
      const inf = m.informe ? (JSON.parse(m.informe) as Informe) : null;
      if (doc.y > doc.page.height - 170) doc.addPage();
      const inicio = doc.y;
      const color = colorDe(m.resultado);
      const resultado = m.resultado ?? 'En revisión';

      // Etiqueta de color con el resultado (a la derecha)
      doc.font('Helvetica-Bold').fontSize(8);
      const anchoEtiqueta = doc.widthOfString(resultado) + 18;
      doc
        .roundedRect(izq + ancho - anchoEtiqueta, inicio, anchoEtiqueta, 16, 8)
        .fill(color);
      doc
        .fillColor('white')
        .text(resultado, izq + ancho - anchoEtiqueta, inicio + 4, {
          width: anchoEtiqueta,
          align: 'center',
        });

      // Nombre, nota y materia equivalente
      doc
        .fillColor('#111111')
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(m.nombre, izq + 14, inicio + 2, {
          width: ancho - anchoEtiqueta - 24,
        });
      doc
        .fillColor(GRIS)
        .font('Helvetica')
        .fontSize(9)
        .text(
          `${textoNota(m)}${inf?.parecido !== undefined ? `   ·   Parecido ${inf.parecido} %` : ''}${inf?.nueva ? `   ·   Equivale a ${inf.nueva}` : ''}`,
          izq + 14,
          doc.y + 2,
          { width: ancho - 14 },
        );

      // Reglas: punto verde si cumple, rojo si no
      for (const c of inf?.causas ?? []) {
        const y = doc.y + 4;
        doc
          .circle(izq + 18, y + 4, 2.5)
          .fill(c.cumple ? COLORES.Homologable : COLORES['No homologable']);
        doc
          .fillColor('#333333')
          .font('Helvetica-Bold')
          .fontSize(9)
          .text(`${c.regla}: `, izq + 26, y, {
            continued: true,
            width: ancho - 26,
          })
          .font('Helvetica')
          .text(`${c.cumple ? 'Cumple' : 'No cumple'} · ${c.causa}`);
      }

      if (inf?.temasFaltan?.length) {
        doc
          .fillColor(COLORES.Pendiente)
          .font('Helvetica-Bold')
          .fontSize(9)
          .text('Temas que faltan: ', izq + 14, doc.y + 4, {
            continued: true,
            width: ancho - 14,
          })
          .fillColor('#333333')
          .font('Helvetica')
          .text(inf.temasFaltan.join(', '));
      }

      // Barra lateral del color del resultado y línea separadora
      const fin = doc.y + 8;
      if (fin > inicio) doc.rect(izq, inicio, 4, fin - inicio).fill(color);
      doc
        .moveTo(izq, fin + 6)
        .lineTo(izq + ancho, fin + 6)
        .lineWidth(0.5)
        .stroke('#dddddd');
      doc.y = fin + 16;
    }

    // Nota del Consejo Directivo
    if (doc.y > doc.page.height - 140) doc.addPage();
    const texto =
      'Este informe es un análisis de apoyo. La homologación oficial la resuelve el Consejo Directivo de la Facultad (Resolución CAU-P-122-2026, art. 15).';
    doc.font('Helvetica').fontSize(8.5);
    const yNota = doc.y + 4;
    const alto = doc.heightOfString(texto, { width: ancho - 30 }) + 20;
    doc.roundedRect(izq, yNota, ancho, alto, 6).fill('#fdf3f4');
    doc.rect(izq, yNota, 4, alto).fill(GUINDA);
    doc
      .fillColor('#5a1220')
      .text(texto, izq + 15, yNota + 10, { width: ancho - 30 });

    // Pie de página en todas las hojas
    const paginas = doc.bufferedPageRange();
    for (let i = 0; i < paginas.count; i++) {
      doc.switchToPage(paginas.start + i);
      doc.page.margins.bottom = 0;
      const yPie = doc.page.height - 35;
      doc
        .moveTo(izq, yPie - 8)
        .lineTo(izq + ancho, yPie - 8)
        .lineWidth(0.5)
        .stroke('#dddddd');
      doc
        .fillColor(GRIS)
        .font('Helvetica')
        .fontSize(7.5)
        .text(`HomologaFISEI · Solicitud N.º ${s.id}`, izq, yPie, {
          width: ancho / 2,
          lineBreak: false,
        })
        .text(`Página ${i + 1} de ${paginas.count}`, izq + ancho / 2, yPie, {
          width: ancho / 2,
          align: 'right',
          lineBreak: false,
        });
    }

    doc.end();
  });
}
