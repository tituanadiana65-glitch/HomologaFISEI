import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, sesion } from '../api';

// Revisión docente: lista de informes que ya tienen el resultado del agente
interface Resumen {
  id: number;
  tipo?: string;
  estudiante?: string | null;
  universidadOrigen?: string | null;
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
  estado: string;
  revisiones: { docenteId: number; docente: string }[];
  _count?: { materias: number };
}
interface Carrera { codigo: string; nombre: string }

export default function Revision() {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [todas, setTodas] = useState(false);
  const [error, setError] = useState('');
  const yo = sesion()?.usuario.id;

  useEffect(() => {
    void api<Resumen[]>('/solicitudes/revision').then(setLista).catch((e: Error) => setError(e.message));
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras);
  }, []);

  const nombre = (codigo: string) => carreras.find((c) => c.codigo === codigo)?.nombre ?? codigo;
  const visibles = (lista ?? []).filter((s) => todas || s.estado !== 'REVISADA');
  const porRevisar = (lista ?? []).filter((s) => s.estado !== 'REVISADA').length;

  return (
    <main>
      <h1>Informes para revisar</h1>
      <p className="ayuda">
        El agente ya analizó estas solicitudes. Revisa cada informe, cambia el resultado de una materia si no estás de acuerdo (con tu comentario) y
        apruébalo. Cada informe necesita la aprobación de <b>dos docentes</b>.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="filtros">
        <button className={todas ? 'pequeno' : ''} onClick={() => setTodas(false)}>
          Por revisar ({porRevisar})
        </button>
        <button className={todas ? '' : 'pequeno'} onClick={() => setTodas(true)}>
          Todos ({lista?.length ?? 0})
        </button>
      </div>
      {!lista ? (
        <p className="vacio">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="vacio">No hay informes {todas ? '' : 'por revisar'} por ahora.</p>
      ) : (
        <div className="tabla-record">
          <table>
            <thead>
              <tr>
                <th>N.º</th>
                <th>Estudiante</th>
                <th>Cambio</th>
                <th>Materias</th>
                <th>Revisión</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((s) => {
                const yaAprobe = s.revisiones.some((r) => r.docenteId === yo);
                return (
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
                      <span className={`etiqueta ${s.estado === 'REVISADA' ? 'homologable' : s.revisiones.length ? 'pendiente' : 'en-revision'}`}>
                        {s.estado === 'REVISADA' ? 'Revisado' : `${s.revisiones.length} de 2`}
                      </span>
                      {s.revisiones.length > 0 && <small className="equivale">{s.revisiones.map((r) => r.docente).join(', ')}</small>}
                      {yaAprobe && s.estado !== 'REVISADA' && <small className="pista bien">Ya lo aprobaste</small>}
                    </td>
                    <td>
                      <Link className="boton pequeno" to={`/revision/${s.id}`}>
                        {s.estado === 'REVISADA' || yaAprobe ? 'Ver' : 'Revisar'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
