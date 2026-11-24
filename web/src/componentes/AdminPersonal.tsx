import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';

// El administrador crea las cuentas del coordinador (asigna docentes) y de los docentes (hacen la homologación)
interface Persona { id: number; nombre: string; correo: string; rol: 'COORDINADOR' | 'DOCENTE' }
const ROL_TEXTO = { COORDINADOR: 'Coordinador', DOCENTE: 'Docente' };

export default function AdminPersonal({ avisar }: { avisar: (texto: string, error?: boolean) => void }) {
  const [personal, setPersonal] = useState<Persona[]>([]);
  const [d, setD] = useState({ nombre: '', correo: '', clave: '', rol: 'DOCENTE' });

  const cargar = () => void api<Persona[]>('/identidad/personal').then(setPersonal).catch(() => setPersonal([]));
  useEffect(cargar, []);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const nuevo = await api<Persona>('/identidad/personal', { method: 'POST', body: JSON.stringify(d) });
      setD({ nombre: '', correo: '', clave: '', rol: d.rol });
      cargar();
      avisar(`Se creó la cuenta de ${ROL_TEXTO[nuevo.rol].toLowerCase()} de ${nuevo.nombre}. Entrégale su correo y contraseña.`);
    } catch (err) {
      avisar((err as Error).message, true);
    }
  };

  return (
    <section className="admin-tarjeta">
      <h2>Coordinador y docentes</h2>
      <p className="ayuda">El coordinador elige qué docente hace la homologación de cada solicitud.</p>
      {personal.length ? (
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Correo</th>
            </tr>
          </thead>
          <tbody>
            {personal.map((x) => (
              <tr key={x.id}>
                <td>{x.nombre}</td>
                <td>{ROL_TEXTO[x.rol]}</td>
                <td>{x.correo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="vacio">Todavía no hay coordinador ni docentes.</p>
      )}
      <h3>Nueva cuenta</h3>
      <form onSubmit={crear}>
        <label>
          Rol
          <select value={d.rol} onChange={(e) => setD({ ...d, rol: e.target.value })}>
            <option value="DOCENTE">Docente (hace la homologación)</option>
            <option value="COORDINADOR">Coordinador (asigna los docentes)</option>
          </select>
        </label>
        <label>
          Nombre
          <input value={d.nombre} placeholder="Ing. Hernán Naranjo" onChange={(e) => setD({ ...d, nombre: e.target.value })} />
        </label>
        <label>
          Correo institucional
          <input type="email" value={d.correo} placeholder="nombre@uta.edu.ec" onChange={(e) => setD({ ...d, correo: e.target.value })} />
        </label>
        <label>
          Contraseña inicial
          <input type="password" value={d.clave} onChange={(e) => setD({ ...d, clave: e.target.value })} />
          <small className="pista">Al menos 8 caracteres.</small>
        </label>
        <button type="submit" disabled={!d.nombre.trim() || !d.correo.trim() || d.clave.length < 8}>
          Crear cuenta
        </button>
      </form>
    </section>
  );
}
