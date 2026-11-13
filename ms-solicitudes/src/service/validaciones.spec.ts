import { revisarRequisitos, validarMateria, validarMateriaExterna, validarSolicitud } from './validaciones';

const datos = { carreraOrigen: 'TI', carreraDestino: 'SW', periodo: 'NOVIEMBRE 2026 - MARZO 2027' };

describe('validarSolicitud', () => {
  it('acepta un cambio de TI a Software', () => {
    expect(validarSolicitud(datos, 0)).toBeNull();
  });

  it('pide los datos que faltan', () => {
    expect(validarSolicitud({ carreraOrigen: 'TI' }, 0)).toMatch(/periodo/);
  });

  it('rechaza la misma carrera en origen y destino', () => {
    expect(validarSolicitud({ ...datos, carreraDestino: 'TI' }, 0)).toMatch(/distinta/);
  });

  it('rechaza una segunda solicitud abierta', () => {
    expect(validarSolicitud(datos, 1)).toMatch(/abierta/);
  });

  it('sin tipo, la solicitud es de la UTA (como en el Sprint 2)', () => {
    expect(validarSolicitud({ ...datos, tipo: undefined }, 0)).toBeNull();
  });

  it('rechaza un tipo que no existe', () => {
    expect(validarSolicitud({ ...datos, tipo: 'OTRO' as never }, 0)).toMatch(/tipo/);
  });
});

// T37 · Solicitud de un estudiante de otra universidad (HU-16)
describe('validarSolicitud de otra universidad', () => {
  const externa = {
    tipo: 'EXTERNO' as const,
    universidadOrigen: 'Universidad Central del Ecuador',
    carreraOrigen: 'Ingeniería Informática',
    carreraDestino: 'SW',
    periodo: 'NOVIEMBRE 2026 - MARZO 2027',
    periodosAprobados: 2,
  };

  it('acepta una solicitud completa', () => {
    expect(validarSolicitud(externa, 0)).toBeNull();
  });

  it('pide la universidad de origen', () => {
    expect(validarSolicitud({ ...externa, universidadOrigen: '  ' }, 0)).toMatch(/universidad/);
  });

  it('pide los periodos aprobados entre 1 y 12', () => {
    expect(validarSolicitud({ ...externa, periodosAprobados: undefined }, 0)).toMatch(/periodos/);
    expect(validarSolicitud({ ...externa, periodosAprobados: 0 }, 0)).toMatch(/periodos/);
    expect(validarSolicitud({ ...externa, periodosAprobados: 13 }, 0)).toMatch(/periodos/);
    expect(validarSolicitud({ ...externa, periodosAprobados: 1.5 }, 0)).toMatch(/periodos/);
  });

  it('no compara origen y destino: la carrera de origen es de otra universidad', () => {
    expect(validarSolicitud({ ...externa, carreraOrigen: 'SW' }, 0)).toBeNull();
  });

  it('tampoco deja tener dos solicitudes abiertas', () => {
    expect(validarSolicitud(externa, 1)).toMatch(/abierta/);
  });
});


const fisica = {
  codigo: 'FIS-TI',
  nivel: 'PRIMERO',
  paralelo: 'A',
  docente: 'Ing. Pérez',
  periodo: 'ABRIL 2025 - AGOSTO 2025',
  anio: 2025,
  nota: 8.5,
  matricula: 1,
};

describe('validarMateria', () => {
  it('acepta Física con nota 8,5', () => {
    expect(validarMateria(fisica, [], 2026)).toBeNull();
  });

  it('pide los datos que faltan', () => {
    expect(validarMateria({ codigo: 'FIS-TI' }, [], 2026)).toMatch(/paralelo/);
  });

  it('rechaza una nota de 11', () => {
    expect(validarMateria({ ...fisica, nota: 11 }, [], 2026)).toMatch(/0 y 10/);
  });

  it('rechaza una cuarta matrícula', () => {
    expect(validarMateria({ ...fisica, matricula: 4 }, [], 2026)).toMatch(/matrícula/);
  });

  it('rechaza un año futuro', () => {
    expect(validarMateria({ ...fisica, anio: 2030 }, [], 2026)).toMatch(/año/);
  });

  it('rechaza una materia repetida', () => {
    expect(validarMateria(fisica, ['FIS-TI'], 2026)).toMatch(/ya está/);
  });
});

// T38 · Materia de otra universidad
describe('validarMateriaExterna', () => {
  const calculo = { nombre: 'Cálculo II', creditos: 4, horas: 160, nota: 16, escala: 20, anio: 2025, silaboId: 7 };

  it('acepta una materia completa', () => {
    expect(validarMateriaExterna(calculo, [], 2026)).toBeNull();
  });

  it('acepta una materia sin sílabo (se compara solo con lo que hay)', () => {
    expect(validarMateriaExterna({ ...calculo, silaboId: undefined }, [], 2026)).toBeNull();
  });

  it('pide el nombre', () => {
    expect(validarMateriaExterna({ ...calculo, nombre: ' ' }, [], 2026)).toMatch(/nombre/);
  });

  it('rechaza créditos u horas que no son enteros positivos', () => {
    expect(validarMateriaExterna({ ...calculo, creditos: 0 }, [], 2026)).toMatch(/créditos/);
    expect(validarMateriaExterna({ ...calculo, creditos: 2.5 }, [], 2026)).toMatch(/créditos/);
    expect(validarMateriaExterna({ ...calculo, horas: -10 }, [], 2026)).toMatch(/horas/);
  });

  it('solo acepta notas sobre 10, 20 o 100', () => {
    expect(validarMateriaExterna({ ...calculo, escala: 5 }, [], 2026)).toMatch(/sobre 10, sobre 20 o sobre 100/);
  });

  it('rechaza una nota mayor que su escala', () => {
    expect(validarMateriaExterna({ ...calculo, nota: 21 }, [], 2026)).toMatch(/entre 0 y 20/);
    expect(validarMateriaExterna({ ...calculo, nota: 85, escala: 100 }, [], 2026)).toBeNull();
  });

  it('revisa el año', () => {
    expect(validarMateriaExterna({ ...calculo, anio: 2027 }, [], 2026)).toMatch(/año/);
  });

  it('no deja registrar dos veces la misma materia', () => {
    expect(validarMateriaExterna({ ...calculo, nombre: 'CALCULO  II' }, ['EXT-CALCULO-II'], 2026)).toMatch(/ya está registrada/);
  });
});

// T45 · RN-08: requisitos de otra universidad
describe('revisarRequisitos (RN-08)', () => {
  const dos = [{ resultado: 'Homologable' }, { resultado: 'Homologable' }, { resultado: 'No homologable' }];
  const ok = { periodosAprobados: 2, documentosLegalizados: true };

  it('cumple con 2 periodos, 2 materias homologables y documentos legalizados', () => {
    const r = revisarRequisitos(ok, dos);
    expect(r.cumple).toBe(true);
    expect(r.causas.map((c) => c.causa)).toEqual([
      'Tiene 2 periodos aprobados (mínimo 2)',
      'Tiene 2 materias homologables (mínimo 2)',
      'Indicó que su malla y su récord están legalizados',
    ]);
  });

  it('no cumple con 1 periodo aprobado', () => {
    const r = revisarRequisitos({ ...ok, periodosAprobados: 1 }, dos);
    expect(r.cumple).toBe(false);
    expect(r.causas[0]).toEqual({ requisito: 'Periodos aprobados', cumple: false, causa: 'Tiene 1 periodo aprobado (mínimo 2)' });
  });

  it('no cumple con menos de 2 materias homologables', () => {
    const r = revisarRequisitos(ok, [{ resultado: 'Homologable' }, { resultado: 'Sin materia equivalente' }]);
    expect(r.cumple).toBe(false);
    expect(r.causas[1].causa).toBe('Tiene 1 materia homologable (mínimo 2)');
  });

  it('no cumple sin documentos legalizados', () => {
    const r = revisarRequisitos({ ...ok, documentosLegalizados: false }, dos);
    expect(r.cumple).toBe(false);
    expect(r.causas[2].causa).toBe('Falta legalizar la malla y el récord académico');
  });
});
