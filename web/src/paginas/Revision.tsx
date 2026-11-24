import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

// Docente: las solicitudes que el coordinador le asignó
interface Resumen {
  id: number;
  tipo?: string;
  estudiante?: string | null;
  universidadOrigen?: string | null;
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
  estado: string;
  coordinador?: string | null;
  asignada?: string | null;
  _count?: { materias: number };
}
interface Carrera { codigo: string; nombre: string }

// En qué etapa está cada homologación
const ETAPA: Record<string, string> = {
  BORRADOR: 'Subir expediente',
  ENVIADA: 'Agente analizando',
  RESULTADO_LISTO: 'Revisar análisis',
  REVISADA: 'Enviada al coordinador',
};

export default function Revision() {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [todas, setTodas] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void api<Resumen[]>('/solicitudes/revision').then(setLista).catch((e: Error) => setError(e.message));
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras);
  }, []);

  const nombre = (codigo: string) => carreras.find((c) => c.codigo === codigo)?.nombre ?? codigo;
  const visibles = (lista ?? []).filter((s) => todas || s.estado !== 'REVISADA');
  const porRevisar = (lista ?? []).filter((s) => s.estado !== 'REVISADA').length;

  return (
    <main>
      <h1>Mis homologaciones</h1>
      <p className="ayuda">
        El coordinador te asignó estas solicitudes. En cada una: sube el expediente del estudiante y sus materias, envíalas al agente, revisa el
        análisis (cambia el resultado de una materia si no estás de acuerdo, con tu comentario) y <b>envía el resultado al coordinador</b>.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="filtros">
        <button className={todas ? 'pequeno' : ''} onClick={() => setTodas(false)}>
          Por hacer ({porRevisar})
        </button>
        <button className={todas ? '' : 'pequeno'} onClick={() => setTodas(true)}>
          Todos ({lista?.length ?? 0})
        </button>
      </div>
      {!lista ? (
        <p className="vacio">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="vacio">{todas ? 'Todavía no te han asignado solicitudes.' : 'No tienes homologaciones pendientes.'}</p>
      ) : (
        <div className="tabla-record">
          <table>
            <thead>
              <tr>
                <th>N.º</th>
                <th>Estudiante</th>
                <th>Cambio</th>
                <th>Materias</th>
                <th>Estado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>
                    <strong>{s.estudiante ?? `Solicitud ${s.id}`}</strong>
                    <small className="equivale">{s.tipo === 'EXTERNO' ? 'Otra universidad' : 'Estudiante de la UTA'}</small>
                  </td>
                  <td className="cambio">
                    {s.tipo === 'EXTERNO' ? `${s.universidadOrigen ?? ''} · ${s.carreraOrigen}` : nombre(s.carreraOrigen)} → <b>{nombre(s.carreraDestino)}</b>
                    <small className="equivale">{s.periodo}</small>
                  </td>
                  <td>{s._count?.materias ?? '—'}</td>
                  <td>
                    <span className={`etiqueta ${s.estado === 'REVISADA' ? 'homologable' : 'pendiente'}`}>{ETAPA[s.estado] ?? s.estado}</span>
                    {s.coordinador && <small className="equivale">Asignada por {s.coordinador}</small>}
                  </td>
                  <td>
                    <Link className="boton pequeno" to={`/homologacion/${s.id}`}>
                      {s.estado === 'REVISADA' ? 'Ver' : 'Abrir'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
