import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';

// Revisión docente: el administrador crea las cuentas de los docentes que revisan los informes
interface Docente { id: number; nombre: string; correo: string }

export default function AdminDocentes({ avisar }: { avisar: (texto: string, error?: boolean) => void }) {
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [d, setD] = useState({ nombre: '', correo: '', clave: '' });

  const cargar = () => void api<Docente[]>('/identidad/docentes').then(setDocentes).catch(() => setDocentes([]));
  useEffect(cargar, []);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const nuevo = await api<Docente>('/identidad/docentes', { method: 'POST', body: JSON.stringify(d) });
      setD({ nombre: '', correo: '', clave: '' });
      cargar();
      avisar(`Se creó la cuenta de ${nuevo.nombre}. Entrega su correo y contraseña al docente.`);
    } catch (err) {
      avisar((err as Error).message, true);
    }
  };

  return (
    <section className="admin-tarjeta">
      <h2>Docentes que revisan los informes</h2>
      <p className="ayuda">Cada informe lo revisan y aprueban dos docentes distintos.</p>
      {docentes.length ? (
        <table>
          <thead>
            <tr>
              <th>Docente</th>
              <th>Correo</th>
            </tr>
          </thead>
          <tbody>
            {docentes.map((x) => (
              <tr key={x.id}>
                <td>{x.nombre}</td>
                <td>{x.correo}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="vacio">Todavía no hay docentes. Crea al menos dos.</p>
      )}
      <h3>Nuevo docente</h3>
      <form onSubmit={crear}>
        <label>
          Nombre
          <input value={d.nombre} placeholder="Ing. Hernán Naranjo" onChange={(e) => setD({ ...d, nombre: e.target.value })} />
        </label>
        <label>
          Correo institucional
          <input type="email" value={d.correo} placeholder="docente@uta.edu.ec" onChange={(e) => setD({ ...d, correo: e.target.value })} />
        </label>
        <label>
          Contraseña inicial
          <input type="password" value={d.clave} onChange={(e) => setD({ ...d, clave: e.target.value })} />
          <small className="pista">Al menos 8 caracteres.</small>
        </label>
        <button type="submit" disabled={!d.nombre.trim() || !d.correo.trim() || d.clave.length < 8}>
          Crear docente
        </button>
      </form>
    </section>
  );
}
