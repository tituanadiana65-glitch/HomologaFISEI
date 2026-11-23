import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, guardarSesion, type Sesion } from '../api';

// Solo entra el personal: administrador, coordinador y docentes (el estudiante entrega su solicitud en papel)
export default function Login() {
  const [datos, setDatos] = useState({ correo: '', clave: '' });
  const [error, setError] = useState('');
  const ir = useNavigate();

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const s = await api<Sesion>('/identidad/login', { method: 'POST', body: JSON.stringify(datos) });
      const inicio: Record<string, string> = { ADMIN: '/admin', COORDINADOR: '/coordinacion', DOCENTE: '/revision' };
      if (!inicio[s.usuario.rol]) {
        setError('Esta cuenta no tiene acceso. Entran el coordinador, los docentes y el administrador.');
        return;
      }
      guardarSesion(s);
      ir(inicio[s.usuario.rol]);
    } catch (err) {
      setError((err as Error).message);
    }
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

        <h2>Iniciar sesión</h2>
        <p className="ayuda">Acceso para el coordinador, los docentes y el administrador. Usa tu correo institucional @uta.edu.ec</p>

        <form onSubmit={enviar}>
          <label>
            Correo institucional
            <input type="email" placeholder="nombre@uta.edu.ec" value={datos.correo} onChange={(e) => setDatos({ ...datos, correo: e.target.value })} />
          </label>
          <label>
            Contraseña
            <input type="password" value={datos.clave} onChange={(e) => setDatos({ ...datos, clave: e.target.value })} />
          </label>
          {error && <p role="alert">{error}</p>}
          <button type="submit">Entrar</button>
        </form>
        <ol className="como-funciona">
          <li>
            <b>El coordinador registra la solicitud</b>
            <span>La que entregó el estudiante, y elige el docente que hará la homologación.</span>
          </li>
          <li>
            <b>El docente sube el expediente</b>
            <span>Récord, malla y sílabos; el sistema lee el récord y llena las materias.</span>
          </li>
          <li>
            <b>El agente analiza y el docente revisa</b>
            <span>El docente corrige si hace falta y envía lo homologable y lo no homologable al coordinador.</span>
          </li>
        </ol>
        <p className="acceso-pie">Análisis previo de homologación. La decisión oficial la toma el Consejo Directivo de la Facultad.</p>
      </div>
    </div>
  );
}
