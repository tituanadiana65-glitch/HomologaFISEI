import { leerPlanIA, armarPedidoPlan, MAX_PLAN } from './plan';

describe('leerPlanIA (planes con otro formato)', () => {
  it('convierte la respuesta en una fila de la matriz', () => {
    const r = leerPlanIA('```json\n{"codigo":null,"nombre":"Robótica Básica","nivel":"primero","creditos":"3","horasTotales":144,"unidades":[{"contenido":"Sensores","horas":72},{"contenido":"","horas":1},{"contenido":"Actuadores"}]}\n```');
    expect(r).toEqual({
      codigo: null,
      nombre: 'Robótica Básica',
      nivel: 'PRIMERO',
      creditos: 3,
      horasTotales: 144,
      objetivoGeneral: null,
      unidades: [
        { contenido: 'Sensores', horas: 72 },
        { contenido: 'Actuadores', horas: null },
      ],
    });
  });

  it('falla si no hay JSON o no hay nombre', () => {
    expect(() => leerPlanIA('no sé')).toThrow('formato esperado');
    expect(() => leerPlanIA('{"nombre":""}')).toThrow('nombre');
  });

  it('recorta textos muy largos', () => {
    expect(armarPedidoPlan('x'.repeat(MAX_PLAN + 50)).length).toBeLessThan(MAX_PLAN + 30);
  });
});
