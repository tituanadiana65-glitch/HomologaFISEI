import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, guardarSesion, type Sesion } from '../api';

export default function Login() {
  const [modo, setModo] = useState<'login' | 'registro'>('login');
  const [datos, setDatos] = useState({ nombre: '', correo: '', clave: '' });
  const [error, setError] = useState('');
  const ir = useNavigate();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const s = await api<Sesion>(`/identidad/${modo}`, { method: 'POST', body: JSON.stringify(datos) });
      guardarSesion(s);
      ir(s.usuario.rol === 'ADMIN' ? '/admin' : '/solicitud');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const cambiarModo = (nuevo: 'login' | 'registro') => {
    setModo(nuevo);
    setError('');
  };

  return (
    <div className="acceso">

      <div className="acceso-form">
        <div className="pestanas">
          <button type="button" className={modo === 'login' ? 'activa' : ''} onClick={() => cambiarModo('login')}>
            Iniciar sesión
          </button>
          <button type="button" className={modo === 'registro' ? 'activa' : ''} onClick={() => cambiarModo('registro')}>
            Crear cuenta
          </button>
        </div>

        <h2>{modo === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}</h2>
        <p className="ayuda">Usa tu correo institucional @uta.edu.ec</p>

        <form onSubmit={enviar}>
          {modo === 'registro' && (
            <label>
              Nombre completo
              <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
            </label>
          )}
          <label>
            Correo institucional
            <input
              type="email"
              placeholder="nombre@uta.edu.ec"
              value={datos.correo}
              onChange={(e) => setDatos({ ...datos, correo: e.target.value })}
            />
          </label>
          <label>
            Contraseña
            <input type="password" value={datos.clave} onChange={(e) => setDatos({ ...datos, clave: e.target.value })} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit">{modo === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
        </form>
      </div>
    </div>
  );
}