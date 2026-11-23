import type { NextFunction, Request, Response } from 'express';
import * as jwt from 'jsonwebtoken';

const PUBLICAS = ['/api/identidad/registro', '/api/identidad/login'];
const SOLO_ADMIN = [
  { metodo: 'POST', ruta: '/api/catalogo/planes' },
  { metodo: 'POST', ruta: '/api/catalogo/carreras' }, // T51
  { metodo: 'PUT', ruta: '/api/reglas/reglas' },
  { metodo: 'POST', ruta: '/api/reglas/reglas' },
  { metodo: 'POST', ruta: '/api/identidad/docentes' }, // revisión docente
  { metodo: 'GET', ruta: '/api/identidad/docentes' },
];
// Revisión docente: solo los docentes revisan y aprueban informes
const SOLO_DOCENTE = ['/api/solicitudes/revision'];

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
    const datos = jwt.verify(token, process.env.JWT_SECRETO ?? 'homologa-sprint2-secreto', { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const soloAdmin = SOLO_ADMIN.some((r) => req.method === r.metodo && url.startsWith(r.ruta));
    if (soloAdmin && datos.rol !== 'ADMIN') return responder(res, 403, 'Solo el administrador puede hacer esto');
    const soloDocente = SOLO_DOCENTE.some((r) => url.startsWith(r));
    if (soloDocente && datos.rol !== 'DOCENTE') return responder(res, 403, 'Solo los docentes pueden revisar informes');
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