import { validarRegistro } from './validaciones';

describe('validarRegistro', () => {
  it('acepta un correo institucional', () => {
    expect(validarRegistro({ nombre: 'Ana', correo: 'ana@uta.edu.ec', clave: 'Clave2026*' })).toBeNull();
  });
  it('rechaza un correo que no es de la UTA', () => {
    expect(validarRegistro({ nombre: 'Ana', correo: 'ana@gmail.com', clave: 'Clave2026*' })).toMatch(/uta\.edu\.ec/);
  });
  it('rechaza una contraseña corta', () => {
    expect(validarRegistro({ nombre: 'Ana', correo: 'ana@uta.edu.ec', clave: '123' })).toMatch(/8/);
  });
});