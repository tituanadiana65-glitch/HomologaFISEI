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
      <section className="acceso-info">
        <strong className="acceso-logo">HomologaFISEI</strong>
        <h1>Homologa tus materias en minutos</h1>
        <p>Registra las materias que aprobaste y recibe un análisis por materia, con su explicación y el informe en PDF.</p>
        <ul>
          <li>✓ Revisión con las reglas de la FISEI</li>
          <li>✓ Resultado y explicación por materia</li>
          <li>✓ Informe en PDF listo para descargar</li>
        </ul>
        <small>Universidad Técnica de Ambato · FISEI</small>
      </section>

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