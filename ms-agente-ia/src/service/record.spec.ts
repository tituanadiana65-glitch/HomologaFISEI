import { leerRecord, unirConCatalogo, armarPedidoRecord, MAX_RECORD } from './record';

// Lectura del récord académico (observación del docente: aprobadas, reprobadas y sin escribir todo a mano)
describe('leerRecord', () => {
  it('lee las materias con su estado, nota, escala y año', () => {
    const r = leerRecord(
      '```json\n{"materias":[{"nombre":"Cálculo II","creditos":4,"horas":160,"nota":16,"escala":20,"anio":2025,"periodo":"2025-1","estado":"Aprobada"},' +
        '{"nombre":"Química","creditos":3,"horas":144,"nota":9,"escala":20,"anio":2024,"periodo":"2024-1","estado":"REPROBADO"}]}\n```',
    );
    expect(r).toEqual([
      { nombre: 'Cálculo II', creditos: 4, horas: 160, nota: 16, escala: 20, anio: 2025, periodo: '2025-1', estado: 'APROBADA', veces: 1 },
      { nombre: 'Química', creditos: 3, horas: 144, nota: 9, escala: 20, anio: 2024, periodo: '2024-1', estado: 'REPROBADA', veces: 1 },
    ]);
  });

  it('si la reprobó y luego la aprobó, queda una sola fila aprobada y cuenta las veces', () => {
    const r = leerRecord(
      '{"materias":[{"nombre":"Física I","nota":10,"escala":20,"anio":2023,"estado":"REPROBADA"},{"nombre":"FÍSICA  I","nota":15,"escala":20,"anio":2024,"estado":"APROBADA"}]}',
    );
    expect(r).toHaveLength(1);
    expect(r[0]).toEqual(expect.objectContaining({ nombre: 'FÍSICA I', nota: 15, anio: 2024, estado: 'APROBADA', veces: 2 }));
  });

  it('sin estado ni escala los deduce de la nota; el año sale del periodo', () => {
    const [a, b, c] = leerRecord(
      '{"materias":[{"nombre":"A","nota":"8,5","periodo":"ABRIL 2024 - AGOSTO 2024"},{"nombre":"B","nota":12},{"nombre":"C","nota":85,"escala":7}]}',
    );
    expect(a).toEqual(expect.objectContaining({ nota: 8.5, escala: 10, anio: 2024, estado: 'APROBADA' }));
    expect(b).toEqual(expect.objectContaining({ escala: 20, estado: 'REPROBADA' }));
    expect(c).toEqual(expect.objectContaining({ escala: 100, estado: 'APROBADA' }));
  });

  it('ignora filas sin nombre y avisa si la respuesta no sirve', () => {
    expect(leerRecord('{"materias":[{"nota":8},{"nombre":"  "}]}')).toEqual([]);
    expect(() => leerRecord('no es json')).toThrow('JSON');
    expect(() => leerRecord('{"otra":1}')).toThrow('lista de materias');
  });

  it('recorta un récord muy largo', () => {
    expect(armarPedidoRecord('x'.repeat(MAX_RECORD + 500)).length).toBeLessThan(MAX_RECORD + 40);
  });
});

describe('unirConCatalogo (UTA)', () => {
  it('une por nombre con la materia de la carrera de origen y completa créditos y horas', () => {
    const catalogo = [{ codigo: 'TI-F', nombre: 'FISICA', nivel: 'PRIMERO', docente: 'Ing. Pérez', creditos: 3, horasTotales: 144 }];
    const [f, q] = unirConCatalogo(
      [
        { nombre: 'Física', creditos: null, horas: null, nota: 8, escala: 10, anio: 2025, periodo: null, estado: 'APROBADA', veces: 1 },
        { nombre: 'Química', creditos: null, horas: null, nota: 8, escala: 10, anio: 2025, periodo: null, estado: 'APROBADA', veces: 1 },
      ],
      catalogo,
    );
    expect(f).toEqual(expect.objectContaining({ codigo: 'TI-F', nivel: 'PRIMERO', docente: 'Ing. Pérez', creditos: 3, horas: 144 }));
    expect(q).toEqual(expect.objectContaining({ codigo: null, nivel: null }));
  });
});
