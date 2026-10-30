const CLAVE = 'homologa.sesion';

export interface Sesion {
  token: string;
  usuario: { id: number; nombre: string; correo: string; rol: string };
}

export function sesion(): Sesion | null {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
  } catch {
    return null;
  }
}

export function guardarSesion(s: Sesion | null) {
  try {
    if (s) localStorage.setItem(CLAVE, JSON.stringify(s));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento */
  }
}

// Llama a /api<ruta> con el token; si falla, lanza un Error con el mensaje del servidor
export async function api<T = unknown>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const headers = new Headers(opciones.headers);
  const s = sesion();
  if (s) headers.set('Authorization', `Bearer ${s.token}`);
  if (opciones.body && !(opciones.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const r = await fetch(`/api${ruta}`, { ...opciones, headers });
  if (r.status === 401 && s) {
    guardarSesion(null);
    location.href = '/';
  }

  const esJson = r.headers.get('content-type')?.includes('json');
  const datos = esJson ? await r.json() : await r.blob();
  if (!r.ok) throw new Error((datos as { message?: string }).message ?? `Error ${r.status}`);
  return datos as T;
}