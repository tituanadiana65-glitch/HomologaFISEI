import { crearPdf, leerRequisitos, textoNota } from './informe-pdf';
import { leerTexto } from './lector-texto';

const solicitud = {
  id: 1,
  carreraOrigen: 'TI',
  carreraDestino: 'SW',
  periodo: 'NOVIEMBRE 2026 - MARZO 2027',
  materias: [
    {
      codigo: 'X',
      nombre: 'FÍSICA',
      nota: 8.5,
      resultado: 'Homologable',
      codigoNueva: 'Y',
      informe: null,
    },
  ],
};

it('genera un PDF', async () => {
  const pdf = await crearPdf(solicitud, 'ana@uta.edu.ec');
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
});

it('genera el PDF con reglas y temas que faltan', async () => {
  const informe = JSON.stringify({
    nueva: 'CÁLCULO INTEGRAL',
    causas: [
      { regla: 'Créditos', cumple: false, causa: 'Créditos 2 de 3 = 66,66 %' },
    ],
    temasFaltan: ['Integrales impropias'],
  });
  const conInforme = {
    ...solicitud,
    materias: [
      { ...solicitud.materias[0], resultado: 'No homologable', informe },
    ],
  };
  const pdf = await crearPdf(conInforme, 'ana@uta.edu.ec');
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
});

// T50 · Informe de una solicitud de otra universidad
describe('T50 · informe de otra universidad', () => {
  const requisitos = {
    cumple: false,
    causas: [
      {
        requisito: 'Periodos aprobados',
        cumple: true,
        causa: 'Tiene 4 periodos aprobados (mínimo 2)',
      },
      {
        requisito: 'Materias homologables',
        cumple: false,
        causa: 'Tiene 1 materia homologable (mínimo 2)',
      },
      {
        requisito: 'Documentos legalizados',
        cumple: true,
        causa: 'Indicó que su malla y su récord están legalizados',
      },
    ],
  };
  const externa = {
    id: 7,
    tipo: 'EXTERNO' as const,
    universidadOrigen: 'Universidad Central del Ecuador',
    carreraOrigen: 'Computación',
    carreraDestino: 'SW',
    periodo: 'NOVIEMBRE 2026 - MARZO 2027',
    requisitos: JSON.stringify(requisitos),
    materias: [
      {
        codigo: 'EXT-CALCULO-II',
        nombre: 'Calculo II',
        nota: 8,
        notaOriginal: 16,
        escala: 20,
        resultado: 'Homologable',
        codigoNueva: 'UTA-FISEI-SF-MP-UB-02-02',
        informe: JSON.stringify({
          nueva: 'CALCULO INTEGRAL (UTA-FISEI-SF-MP-UB-02-02)',
          parecido: 85,
          causas: [
            {
              regla: 'RN-01',
              cumple: true,
              causa: 'Contenidos 90 % (mínimo 80 %)',
            },
          ],
          temasFaltan: [],
        }),
      },
    ],
  };

  it('muestra la nota original y la convertida', () => {
    expect(textoNota(externa.materias[0])).toBe(
      'Nota 16 / 20 (8,0 / 10 en la UTA)',
    );
    expect(
      textoNota({
        ...externa.materias[0],
        notaOriginal: null,
        escala: null,
        nota: 8.5,
      }),
    ).toBe('Nota 8.5');
  });

  it('lee la revisión de RN-08 solo si es de otra universidad', () => {
    expect(leerRequisitos(externa)?.cumple).toBe(false);
    expect(leerRequisitos({ ...externa, tipo: 'INTERNO' })).toBeNull();
    expect(leerRequisitos({ ...externa, requisitos: null })).toBeNull();
  });

  it('el PDF trae la universidad, la nota original, el parecido y RN-08', async () => {
    const pdf = await crearPdf(externa, 'kevin@uta.edu.ec');
    const texto = await leerTexto(pdf);
    // el nombre largo de la universidad se parte en dos líneas dentro de su casilla
    expect(texto).toContain('UNIVERSIDAD DE ORIGEN');
    expect(texto).toContain('Universidad Central del');
    expect(texto).toContain('16 / 20');
    expect(texto).toContain('Parecido 85 %');
    expect(texto).toContain(
      'No cumple los requisitos para cambiarse desde otra universidad (RN-08)',
    );
    expect(texto).toContain('Materias homologables');
  });
});
