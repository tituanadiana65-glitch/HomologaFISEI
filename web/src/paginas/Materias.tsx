import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Pasos from '../componentes/Pasos';

interface Carrera { codigo: string; nombre: string }
interface Asignatura { codigo: string; nombre: string; docente: string }
interface Materia { codigo: string; nombre: string; nivel: string; nota: number }
interface Solicitud {
  id: number;
  estado: string;
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
  materias: Materia[];
}

const vacia = { codigo: '', paralelo: 'A', docente: '', periodo: '', anio: 2025, nota: 7, matricula: 1 };

export default function Materias() {
  const [s, setS] = useState<Solicitud | null>(null);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [niveles, setNiveles] = useState<string[]>([]);
  const [nivel, setNivel] = useState('');
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [m, setM] = useState(vacia);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0); // cambia para volver a cargar la solicitud
  const ir = useNavigate();

  const recargar = () => setVersion((v) => v + 1);
  const nombreCarrera = (codigo: string) => carreras.find((c) => c.codigo === codigo)?.nombre ?? codigo;

  // Nombres de las carreras (para mostrar "Tecnologías de la Información" en vez de "TI")
  useEffect(() => {
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras);
  }, []);

  // Carga la solicitud del estudiante y los niveles de su carrera de origen
  useEffect(() => {
    let activo = true;
    void (async () => {
      const sol = await api<Solicitud | null>('/solicitudes/mia');
      if (!activo) return;
      if (!sol) return ir('/solicitud');
      if (sol.estado !== 'BORRADOR') return ir('/resultado');
      setS(sol);
      const lista = await api<string[]>(`/catalogo/niveles?carrera=${sol.carreraOrigen}`);
      if (activo) setNiveles(lista);
    })();
    return () => {
      activo = false;
    };
  }, [ir, version]);

  // Carga las materias del nivel elegido
  useEffect(() => {
    if (s && nivel) {
      void api<Asignatura[]>(
        `/catalogo/asignaturas?carrera=${s.carreraOrigen}&nivel=${encodeURIComponent(nivel)}`,
      ).then(setAsignaturas);
    }
  }, [s, nivel]);

  const agregar = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api(`/solicitudes/${s!.id}/materias`, { method: 'POST', body: JSON.stringify({ ...m, nivel }) });
      setM(vacia);
      setError('');
      recargar();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const quitar = async (codigo: string) => {
    await api(`/solicitudes/${s!.id}/materias/${codigo}`, { method: 'DELETE' });
    recargar();
  };

  const enviar = async () => {
    try {
      await api(`/solicitudes/${s!.id}/enviar`, { method: 'POST' });
      ir('/resultado');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <main>
      <h1>Tus materias aprobadas</h1>
      <p className="ayuda">Registra una por una las materias que aprobaste. Cuando termines, envíalas a homologar.</p>
      <Pasos actual={2} />

      {s && (
        <div className="resumen-solicitud">
          <div>
            <small>Carrera de origen</small>
            <strong>{nombreCarrera(s.carreraOrigen)}</strong>
          </div>
          <span className="flecha">→</span>
          <div>
            <small>Carrera de destino</small>
            <strong>{nombreCarrera(s.carreraDestino)}</strong>
          </div>
          <div className="periodo">
            <small>Periodo</small>
            <strong>{s.periodo}</strong>
          </div>
        </div>
      )}

      <h2>Agregar una materia</h2>
      <form className="doble" onSubmit={agregar}>
        <label>
          Nivel
          <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
            <option value="">Elige</option>
            {niveles.map((n) => <option key={n}>{n}</option>)}
          </select>
        </label>
        <label>
          Materia de {s ? nombreCarrera(s.carreraOrigen) : 'tu carrera'}
          <select
            value={m.codigo}
            onChange={(e) =>
              setM({ ...m, codigo: e.target.value, docente: asignaturas.find((a) => a.codigo === e.target.value)?.docente ?? '' })
            }
          >
            <option value="">Elige</option>
            {asignaturas.map((a) => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
          </select>
        </label>
        <label>
          Paralelo
          <input value={m.paralelo} onChange={(e) => setM({ ...m, paralelo: e.target.value })} />
        </label>
        <label>
          Docente
          <input value={m.docente} onChange={(e) => setM({ ...m, docente: e.target.value })} />
        </label>
        <label>
          Periodo
          <input value={m.periodo} placeholder="ABRIL 2025 - AGOSTO 2025" onChange={(e) => setM({ ...m, periodo: e.target.value })} />
        </label>
        <label>
          Año de aprobación
          <input type="number" value={m.anio} onChange={(e) => setM({ ...m, anio: Number(e.target.value) })} />
        </label>
        <label>
          Nota
          <input type="number" step="0.1" value={m.nota} onChange={(e) => setM({ ...m, nota: Number(e.target.value) })} />
        </label>
        <label>
          Matrícula
          <select value={m.matricula} onChange={(e) => setM({ ...m, matricula: Number(e.target.value) })}>
            <option value={1}>Primera</option>
            <option value={2}>Segunda</option>
            <option value={3}>Tercera</option>
          </select>
        </label>
        {error && <p role="alert">{error}</p>}
        <button type="submit">Agregar materia</button>
      </form>

      <h2>Registradas</h2>
      {!s?.materias.length && <p className="vacio">Aún no registras materias.</p>}
      <ul className="lista">
        {s?.materias.map((x) => (
          <li key={x.codigo}>
            <span>
              <strong>{x.nombre}</strong>
              <small>
                {x.nivel} · nota {x.nota}
              </small>
            </span>
            <button onClick={() => void quitar(x.codigo)}>Quitar</button>
          </li>
        ))}
      </ul>
      <div className="acciones final">
        <button onClick={() => void enviar()} disabled={!s?.materias.length}>
          Enviar a homologar →
        </button>
      </div>
    </main>
  );
}