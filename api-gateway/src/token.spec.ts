import * as jwt from 'jsonwebtoken';
import { revisarToken } from './token';

const secreto = 'clave-de-prueba';
process.env.JWT_SECRETO = secreto; // en el sistema viene del archivo .env

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
  it('login, health y consultas GET al catálogo no piden token', () => {
    for (const [m, u] of [['POST', '/api/identidad/login'], ['GET', '/api/agente/health'], ['GET', '/api/catalogo/carreras']]) {
      expect(llamar(m, u).next).toHaveBeenCalled();
    }
  });
  it('sin JWT_SECRETO en .env no acepta ningún token (no hay clave escrita en el código, T52)', () => {
    const guardada = process.env.JWT_SECRETO;
    delete process.env.JWT_SECRETO;
    const { next, res } = llamar('GET', '/api/solicitudes', jwt.sign({ sub: 1, rol: 'ADMIN' }, 'homologa-sprint2-secreto'));
    process.env.JWT_SECRETO = guardada;
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
  it('el registro ya no es público: sin token responde 401', () => {
    const { next, res } = llamar('POST', '/api/identidad/registro');
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });
  it('deja pasar el OPTIONS del navegador (CORS)', () => {
    expect(llamar('OPTIONS', '/api/solicitudes/mia').next).toHaveBeenCalled();
  });
  it('pasa el nombre del estudiante codificado (con tildes y ñ) para el informe', () => {
    const conNombre = jwt.sign({ sub: 5, correo: 'ana@uta.edu.ec', nombre: 'Ana Tituaña', rol: 'ESTUDIANTE' }, secreto);
    const { req } = llamar('GET', '/api/documentos/informes/1', conNombre);
    expect(decodeURIComponent(req.headers['x-usuario-nombre'])).toBe('Ana Tituaña');
  });
  it('un token viejo sin nombre no pone el encabezado', () => {
    expect(llamar('GET', '/api/solicitudes/mia', estudiante).req.headers['x-usuario-nombre']).toBeUndefined();
  });
  it('borra los encabezados x-usuario que mande el cliente', () => {
    const req: any = { method: 'GET', originalUrl: '/api/catalogo/carreras', headers: { 'x-usuario-rol': 'ADMIN', 'x-usuario-nombre': 'Falso' } };
    revisarToken(req, { status: jest.fn().mockReturnThis(), json: jest.fn() } as any, jest.fn());
    expect(req.headers['x-usuario-rol']).toBeUndefined();
    expect(req.headers['x-usuario-nombre']).toBeUndefined();
  });

  it('solo el administrador crea coordinadores y docentes', () => {
    expect(llamar('POST', '/api/identidad/personal', estudiante).res.status).toHaveBeenCalledWith(403);
    expect(llamar('GET', '/api/identidad/personal', estudiante).res.status).toHaveBeenCalledWith(403);
    expect(llamar('POST', '/api/identidad/personal', admin).next).toHaveBeenCalled();
  });
  it('el coordinador asigna y ve los docentes; el docente hace la homologación', () => {
    const coordinador = jwt.sign({ sub: 8, correo: 'c@uta.edu.ec', nombre: 'Ing. C', rol: 'COORDINADOR' }, secreto);
    const docente = jwt.sign({ sub: 9, correo: 'd@uta.edu.ec', nombre: 'Ing. D', rol: 'DOCENTE' }, secreto);
    expect(llamar('GET', '/api/identidad/docentes', coordinador).next).toHaveBeenCalled();
    expect(llamar('GET', '/api/identidad/docentes', estudiante).res.status).toHaveBeenCalledWith(403);
    expect(llamar('PUT', '/api/solicitudes/coordinacion/3/docente', coordinador).next).toHaveBeenCalled();
    expect(llamar('PUT', '/api/solicitudes/coordinacion/3/docente', docente).res.status).toHaveBeenCalledWith(403);
    expect(llamar('GET', '/api/solicitudes/revision', estudiante).res.status).toHaveBeenCalledWith(403);
    expect(llamar('GET', '/api/solicitudes/revision', coordinador).res.status).toHaveBeenCalledWith(403);
    expect(llamar('POST', '/api/solicitudes/revision/3/terminar', docente).req.headers['x-usuario-rol']).toBe('DOCENTE');
  });
});
