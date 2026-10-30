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
      ir('/solicitud');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main>
      <h1>HomologaFISEI</h1>
      <form onSubmit={enviar}>
        {modo === 'registro' && (
          <label>
            Nombre <input value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
          </label>
        )}
        <label>
          Correo institucional{' '}
          <input type="email" value={datos.correo} onChange={(e) => setDatos({ ...datos, correo: e.target.value })} />
        </label>
        <label>
          Contraseña{' '}
          <input type="password" value={datos.clave} onChange={(e) => setDatos({ ...datos, clave: e.target.value })} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">{modo === 'login' ? 'Entrar' : 'Crear cuenta'}</button>
      </form>
      <button onClick={() => setModo(modo === 'login' ? 'registro' : 'login')}>
        {modo === 'login' ? 'No tengo cuenta' : 'Ya tengo cuenta'}
      </button>
    </main>
  );
}