import type { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

const PUBLICAS = ['/api/identidad/registro', '/api/identidad/login'];
const SOLO_ADMIN = [
  { metodo: 'POST', ruta: '/api/catalogo/planes' },
  { metodo: 'POST', ruta: '/api/catalogo/carreras' }, // T51
  { metodo: 'PUT', ruta: '/api/reglas/reglas' },
  { metodo: 'POST', ruta: '/api/reglas/reglas' },
];

const responder = (res: Response, estado: number, message: string) => res.status(estado).json({ message });

// Revisa el token y pasa a los servicios quién es el usuario
export function revisarToken(req: Request, res: Response, next: NextFunction) {
  for (const h of ['x-usuario-id', 'x-usuario-rol', 'x-usuario-correo']) delete req.headers[h]; // nadie los puede inventar
  if (req.method === 'OPTIONS') return next(); // el navegador pregunta (CORS) antes de enviar el token
  const url = req.originalUrl.split('?')[0].replace(/(.)\/+$/, '$1');
  const consultaCatalogo = req.method === 'GET' && url.startsWith('/api/catalogo/');
  if (!url.startsWith('/api/') || url.endsWith('/health') || PUBLICAS.includes(url) || consultaCatalogo) return next();
  const token = (req.headers.authorization ?? '').replace(/^Bearer /, '');
  try {
    const datos = jwt.verify(token, process.env.JWT_SECRETO ?? 'homologa-sprint2-secreto', { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const soloAdmin = SOLO_ADMIN.some((r) => req.method === r.metodo && url.startsWith(r.ruta));
    if (soloAdmin && datos.rol !== 'ADMIN') return responder(res, 403, 'Solo el administrador puede hacer esto');
    req.headers['x-usuario-id'] = String(datos.sub);
    req.headers['x-usuario-rol'] = String(datos.rol);
    req.headers['x-usuario-correo'] = String(datos.correo);
    next();
  } catch {
    responder(res, 401, 'Inicia sesión para continuar');
  }
}