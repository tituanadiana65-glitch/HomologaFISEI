import { validarSolicitud } from './validaciones';

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
