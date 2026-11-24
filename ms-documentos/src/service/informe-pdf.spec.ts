import { armarFilas, conNombresDeCarrera, crearPdf, leerRequisitos, nombreEstudiante, textoNota } from './informe-pdf';
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

// Prueba T47 (E-8): el informe muestra el nombre del estudiante y el nombre de la carrera
describe('nombre del estudiante y de las carreras', () => {
  const carreras = [
    { codigo: 'SW', nombre: 'Software' },
    { codigo: 'TI', nombre: 'Tecnologías de la Información' },
  ];

  it('usa el nombre (con tildes y ñ) y, si no hay, el correo', () => {
    expect(nombreEstudiante(encodeURIComponent('Diana Tituaña'), 'd@uta.edu.ec')).toBe('Diana Tituaña');
    expect(nombreEstudiante(undefined, 'd@uta.edu.ec')).toBe('d@uta.edu.ec');
    expect(nombreEstudiante('%E0%A4%A', 'd@uta.edu.ec')).toBe('d@uta.edu.ec');
  });

  it('cambia los códigos por los nombres de las carreras', () => {
    const r = conNombresDeCarrera(solicitud, carreras);
    expect(r.carreraOrigen).toBe('Tecnologías de la Información');
    expect(r.carreraDestino).toBe('Software');
  });

  it('en otra universidad deja la carrera de origen como la escribió el estudiante', () => {
    const r = conNombresDeCarrera({ ...solicitud, tipo: 'EXTERNO', carreraOrigen: 'TI' }, carreras);
    expect(r.carreraOrigen).toBe('TI');
    expect(r.carreraDestino).toBe('Software');
  });

  it('si el catálogo no respondió deja los códigos', () => {
    expect(conNombresDeCarrera(solicitud, []).carreraDestino).toBe('SW');
  });

  it('el PDF trae el nombre completo en una sola línea y la carrera con su nombre', async () => {
    const largo = 'Diana Pamela Tituaña Calapiña de los Ángeles';
    const pdf = await crearPdf(conNombresDeCarrera(solicitud, carreras), largo);
    const texto = await leerTexto(pdf);
    expect(texto).toContain(largo);
    expect(texto).toContain('Software');
  });
});

// HU-26 · filas del informe
describe('materias juntas', () => {
  const base = { nota: 8, codigoNueva: null, informe: null };
  const informeDe = (nueva: string, resultado: string) => JSON.stringify({ nueva, resultado, causas: [{ regla: 'RN-01', cumple: true, causa: 'Contenidos 90 %' }], temasFaltan: [] });

  it('las materias juntas forman una fila', () => {
    const filas = armarFilas([
      { ...base, codigo: 'A', nombre: 'Física I', resultado: 'Homologable', juntoCon: 'B' },
      { ...base, codigo: 'B', nombre: 'Física II', resultado: 'Homologable', juntoCon: 'A' },
      { ...base, codigo: 'C', nombre: 'Química', resultado: 'Sin materia equivalente' },
    ]);
    expect(filas.map((f) => [f.materias.map((m) => m.codigo).join('+'), f.resultado])).toEqual([
      ['A+B', 'Homologable'],
      ['C', 'Sin materia equivalente'],
    ]);
  });

  it('el PDF muestra las materias juntas y el aviso', async () => {
    const aviso = JSON.stringify({ nueva: 'FÍSICA (SW-F)', resultado: 'No homologable', causas: [], temasFaltan: [], aviso: 'Esta materia es una parte de FÍSICA.' });
    const pdf = await crearPdf(
      {
        ...solicitud,
        materias: [
          { ...base, codigo: 'A', nombre: 'Física I', resultado: 'Homologable', juntoCon: 'B', informe: informeDe('FÍSICA (SW-F)', 'Homologable') },
          { ...base, codigo: 'B', nombre: 'Física II', resultado: 'Homologable', juntoCon: 'A', informe: informeDe('FÍSICA (SW-F)', 'Homologable') },
          { ...base, codigo: 'D', nombre: 'Química I', resultado: 'No homologable', informe: aviso },
        ],
      },
      'Ana',
    );
    const texto = await leerTexto(pdf);
    expect(texto).toContain('Física I + Física II');
    expect(texto).toContain('Evaluadas juntas');
    expect(texto).toContain('Esta materia es una parte de FÍSICA.');
  });
});

// Coordinador y docente en el PDF
describe('homologación del docente en el informe', () => {
  const base = { nota: 8, codigoNueva: null, informe: null };
  it('usa el resultado del docente, muestra su comentario, quién la hizo y quién lo asignó', async () => {
    const pdf = await crearPdf(
      {
        ...solicitud,
        estado: 'REVISADA',
        docente: 'Ing. Ana Pérez',
        coordinador: 'Ing. Luis Mora',
        terminada: '2026-11-23T10:00:00Z',
        comentarioFinal: 'Revisado con los sílabos',
        materias: [
          {
            ...base,
            codigo: 'A',
            nombre: 'Química',
            resultado: 'Homologable',
            resultadoDocente: 'No homologable',
            comentarioDocente: 'No tiene laboratorio',
            docenteCambio: 'Ing. Ana Pérez',
            informe: JSON.stringify({ nueva: 'QUIMICA (Q)', resultado: 'Homologable', causas: [], temasFaltan: [] }),
          },
          {
            ...base,
            codigo: 'B',
            nombre: 'Fundamentos de Programación',
            resultado: 'Sin materia equivalente',
            resultadoDocente: 'Homologable',
            comentarioDocente: 'Mismo contenido',
            docenteCambio: 'Ing. Ana Pérez',
            nuevaDocente: 'ALGORITMOS Y LOGICA DE PROGRAMACION (SW-AL)',
          },
        ],
      },
      'Ana',
    );
    const texto = await leerTexto(pdf);
    expect(texto).toContain('Homologación hecha por Ing. Ana Pérez');
    expect(texto).toContain('Docente asignado por Ing. Luis Mora');
    expect(texto).toContain('Revisado con los sílabos');
    expect(texto).toContain('Cambiado por Ing. Ana Pérez');
    expect(texto).toContain('No tiene laboratorio');
    expect(texto.replace(/\s+/g, ' ')).toContain('Equivale a ALGORITMOS Y LOGICA DE PROGRAMACION (SW-AL) (elegida por el docente)');
  });

  it('sin docente dice que el coordinador lo asignará; con docente, que está en revisión', async () => {
    expect(await leerTexto(await crearPdf({ ...solicitud, estado: 'RESULTADO_LISTO' }, 'Ana'))).toContain('el coordinador asignará un docente');
    expect(await leerTexto(await crearPdf({ ...solicitud, estado: 'RESULTADO_LISTO', docente: 'Ing. Ana' }, 'Ana'))).toContain('En revisión por Ing. Ana');
  });
});
