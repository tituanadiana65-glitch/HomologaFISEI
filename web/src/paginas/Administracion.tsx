import { useEffect, useState } from 'react';
import { api, guardarSesion } from '../api';

interface Regla {
  codigo: string;
  carrera: string;
  descripcion: string;
  valor: number;
  activa: boolean;
  version: number;
}

export default function Administracion() {
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void api<Regla[]>('/reglas/reglas')
      .then((r) => {
        setReglas(r);
        setValores(Object.fromEntries(r.map((x) => [x.codigo, String(x.valor)])));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const guardar = async (r: Regla, cambios: { valor?: number; activa?: boolean }) => {
    setMensaje('');
    setError('');
    try {
      const nueva = await api<Regla>(`/reglas/reglas/${r.codigo}`, { method: 'PUT', body: JSON.stringify(cambios) });
      setReglas((rs) => rs.map((x) => (x.codigo === nueva.codigo ? nueva : x)));
      setValores((v) => ({ ...v, [nueva.codigo]: String(nueva.valor) }));
      setMensaje(`${nueva.codigo} actualizada (versión ${nueva.version})`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const salir = () => {
    guardarSesion(null);
    location.href = '/';
  };

  return (
    <main>
      <h1>Administración · Reglas de homologación</h1>
      {mensaje && <p role="status">{mensaje}</p>}
      {error && <p role="alert">{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Código</th>
            <th>Descripción</th>
            <th>Valor</th>
            <th>Estado</th>
            <th>Versión</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {reglas.map((r) => (
            <tr key={r.codigo}>
              <td>{r.codigo}</td>
              <td>{r.descripcion}</td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  value={valores[r.codigo] ?? ''}
                  onChange={(e) => setValores({ ...valores, [r.codigo]: e.target.value })}
                />
              </td>
              <td>{r.activa ? 'Activa' : 'Desactivada'}</td>
              <td>{r.version}</td>
              <td>
                <button onClick={() => void guardar(r, { valor: Number(valores[r.codigo]) })}>Guardar valor</button>{' '}
                <button onClick={() => void guardar(r, { activa: !r.activa })}>{r.activa ? 'Desactivar' : 'Activar'}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={salir}>Salir</button>
    </main>
  );
}