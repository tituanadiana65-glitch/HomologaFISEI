import * as jwt from 'jsonwebtoken';
import { revisarToken } from './token';

const secreto = 'homologa-sprint2-secreto';

function llamar(metodo: string, url: string, token?: string) {
  const req: any = { method: metodo, originalUrl: url, headers: token ? { authorization: `Bearer ${token}` } : {} };
  const res: any = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  revisarToken(req, res, next);
  return { req, res, next };
}

describe('revisarToken', () => {
  const estudiante = jwt.sign({ sub: 5, correo: 'ana@uta.edu.ec', rol: 'ESTUDIANTE' }, secreto);
  const admin = jwt.sign({ sub: 1, correo: 'admin@uta.edu.ec', rol: 'ADMIN' }, secreto);

  it('sin token responde 401', () => {
    const { res, next } = llamar('GET', '/api/solicitudes/mia');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
  it('estudiante no puede importar planes: 403', () => {
    expect(llamar('POST', '/api/catalogo/planes/importar', estudiante).res.status).toHaveBeenCalledWith(403);
  });
  it('T51: estudiante no puede crear carreras: 403', () => {
    expect(llamar('POST', '/api/catalogo/carreras', estudiante).res.status).toHaveBeenCalledWith(403);
  });
  it('T51: administrador sí puede crear carreras', () => {
    expect(llamar('POST', '/api/catalogo/carreras', admin).next).toHaveBeenCalled();
  });
  it('administrador sí puede importar planes', () => {
    expect(llamar('POST', '/api/catalogo/planes/importar', admin).next).toHaveBeenCalled();
  });
  it('token válido llama a next y pone x-usuario-id', () => {
    const { req, next } = llamar('GET', '/api/solicitudes/mia', estudiante);
    expect(next).toHaveBeenCalled();
    expect(req.headers['x-usuario-id']).toBe('5');
    expect(req.headers['x-usuario-rol']).toBe('ESTUDIANTE');
  });
  it('login, registro, health y consultas GET al catálogo no piden token', () => {
    for (const [m, u] of [['POST', '/api/identidad/login'], ['POST', '/api/identidad/registro'], ['GET', '/api/agente/health'], ['GET', '/api/catalogo/carreras']]) {
      expect(llamar(m, u).next).toHaveBeenCalled();
    }
  });
  it('deja pasar el OPTIONS del navegador (CORS)', () => {
    expect(llamar('OPTIONS', '/api/solicitudes/mia').next).toHaveBeenCalled();
  });
  it('borra los encabezados x-usuario que mande el cliente', () => {
    const req: any = { method: 'GET', originalUrl: '/api/catalogo/carreras', headers: { 'x-usuario-rol': 'ADMIN' } };
    revisarToken(req, { status: jest.fn().mockReturnThis(), json: jest.fn() } as any, jest.fn());
    expect(req.headers['x-usuario-rol']).toBeUndefined();
  });
});