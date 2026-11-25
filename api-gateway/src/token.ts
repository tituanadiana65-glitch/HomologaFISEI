import type { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

const PUBLICAS = ['/api/identidad/login']; // sin registro: las cuentas las crea el administrador
const SOLO_ADMIN = [
  { metodo: 'POST', ruta: '/api/catalogo/planes' },
  { metodo: 'POST', ruta: '/api/catalogo/carreras' }, // T51
  { metodo: 'PUT', ruta: '/api/reglas/reglas' },
  { metodo: 'POST', ruta: '/api/reglas/reglas' },
  { metodo: 'POST', ruta: '/api/identidad/personal' }, // crea coordinadores y docentes
  { metodo: 'GET', ruta: '/api/identidad/personal' },
];
// Coordinador y docente: el coordinador asigna un docente a cada solicitud y el docente hace la homologación
const POR_ROL = [
  { ruta: '/api/solicitudes/coordinacion', roles: ['COORDINADOR'], mensaje: 'Solo el coordinador asigna docentes' },
  { ruta: '/api/solicitudes/revision', roles: ['DOCENTE'], mensaje: 'Solo el docente asignado hace la homologación' },
  { ruta: '/api/identidad/docentes', roles: ['ADMIN', 'COORDINADOR'], mensaje: 'Solo el coordinador ve la lista de docentes' },
];

const responder = (res: Response, estado: number, message: string) => res.status(estado).json({ message });

// Revisa el token y pasa a los servicios quién es el usuario
export function revisarToken(req: Request, res: Response, next: NextFunction) {
  for (const h of ['x-usuario-id', 'x-usuario-rol', 'x-usuario-correo', 'x-usuario-nombre']) delete req.headers[h]; // nadie los puede inventar
  if (req.method === 'OPTIONS') return next(); // el navegador pregunta (CORS) antes de enviar el token
  const url = req.originalUrl.split('?')[0].replace(/(.)\/+$/, '$1');
  const consultaCatalogo = req.method === 'GET' && url.startsWith('/api/catalogo/');
  if (!url.startsWith('/api/') || url.endsWith('/health') || PUBLICAS.includes(url) || consultaCatalogo) return next();
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    // La clave viene del archivo .env (T52): no hay una clave escrita en el código
    const secreto = process.env.JWT_SECRETO;
    if (!secreto) return responder(res, 500, 'Falta JWT_SECRETO en el archivo .env');
    const datos = jwt.verify(token, secreto, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const soloAdmin = SOLO_ADMIN.some((r) => req.method === r.metodo && url.startsWith(r.ruta));
    if (soloAdmin && datos.rol !== 'ADMIN') return responder(res, 403, 'Solo el administrador puede hacer esto');
    const regla = POR_ROL.find((r) => url.startsWith(r.ruta));
    if (regla && !regla.roles.includes(String(datos.rol))) return responder(res, 403, regla.mensaje);
    req.headers['x-usuario-id'] = String(datos.sub);
    req.headers['x-usuario-rol'] = String(datos.rol);
    req.headers['x-usuario-correo'] = String(datos.correo);
    // El nombre puede tener tildes y ñ: va codificado para que viaje bien en el encabezado (lo usa el informe PDF)
    if (datos.nombre) req.headers['x-usuario-nombre'] = encodeURIComponent(String(datos.nombre));
    next();
  } catch {
    responder(res, 401, 'Inicia sesión para continuar');
  }
}