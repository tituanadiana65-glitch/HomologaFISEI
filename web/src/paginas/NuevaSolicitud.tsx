import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

interface Carrera { codigo: string; nombre: string }
interface Solicitud { id: number; estado: string }

export default function NuevaSolicitud() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [d, setD] = useState({ carreraOrigen: 'TI', carreraDestino: 'SW', periodo: 'NOVIEMBRE 2026 - MARZO 2027' });
  const [error, setError] = useState('');
  const ir = useNavigate();

  useEffect(() => {
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras);
    void api<Solicitud | null>('/solicitudes/mia').then((s) => {
      if (s?.estado === 'BORRADOR') ir('/materias');
      else if (s && s.estado !== 'RESULTADO_LISTO') ir('/resultado');
    });
  }, [ir]);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/solicitudes', { method: 'POST', body: JSON.stringify(d) });
      ir('/materias');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const opciones = carreras.map((c) => (
    <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
  ));

  return (
    <main>
      <h1>Paso 1 · Nueva solicitud de cambio de carrera</h1>
      <form onSubmit={crear}>
        <label>
          Carrera de origen{' '}
          <select value={d.carreraOrigen} onChange={(e) => setD({ ...d, carreraOrigen: e.target.value })}>{opciones}</select>
        </label>
        <label>
          Carrera de destino{' '}
          <select value={d.carreraDestino} onChange={(e) => setD({ ...d, carreraDestino: e.target.value })}>{opciones}</select>
        </label>
        <label>
          Periodo <input value={d.periodo} onChange={(e) => setD({ ...d, periodo: e.target.value })} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Crear solicitud</button>
      </form>
    </main>
  );
}