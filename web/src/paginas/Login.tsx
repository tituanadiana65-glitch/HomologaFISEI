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
      ir(s.usuario.rol === 'ADMIN' ? '/admin' : s.usuario.rol === 'DOCENTE' ? '/revision' : '/solicitud');
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
        <div className="acceso-marca">
          <span className="logo">H</span>
          <div>
            <strong>HomologaFISEI</strong>
            <small>Universidad Técnica de Ambato · FISEI</small>
          </div>
        </div>
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
              <input value={datos.nombre} placeholder="Como aparecerá en tu informe" onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
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
            {modo === 'registro' && <small className="pista">Al menos 8 caracteres.</small>}
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit">{modo === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
        </form>
        <ol className="como-funciona">
          <li>
            <b>Crea tu solicitud</b>
            <span>Dinos de qué carrera o universidad vienes y a cuál te cambias.</span>
          </li>
          <li>
            <b>Registra tus materias</b>
            <span>Las que aprobaste, con su nota (y su sílabo si vienes de otra universidad).</span>
          </li>
          <li>
            <b>Recibe tu análisis</b>
            <span>Qué materias se te podrían homologar, por qué, y un informe en PDF.</span>
          </li>
        </ol>
        <p className="acceso-pie">Análisis previo de homologación. La decisión oficial la toma el Consejo Directivo de la Facultad.</p>
      </div>
    </div>
  );
}