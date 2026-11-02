import { validarMateria, validarSolicitud } from './validaciones';

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
