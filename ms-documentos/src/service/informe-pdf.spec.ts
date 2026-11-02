import { crearPdf } from './informe-pdf';

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
