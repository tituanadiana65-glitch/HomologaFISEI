import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

// Coordinador: registra las solicitudes que entregan los estudiantes, elige el docente y recibe el resultado
interface Resumen {
  id: number;
  tipo?: string;
  estudiante?: string | null;
  universidadOrigen?: string | null;
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
  estado: string;
  docenteId?: number | null;
  docente?: string | null;
  asignada?: string | null;
  terminada?: string | null;
  _count?: { materias: number };
}
interface Docente { id: number; nombre: string }
interface Carrera { codigo: string; nombre: string }
type Filtro = 'sin' | 'revision' | 'terminadas' | 'todas';

// En qué etapa está cada homologación
const ETAPA: Record<string, string> = {
  BORRADOR: 'El docente sube el expediente',
  ENVIADA: 'El agente está analizando',
  RESULTADO_LISTO: 'El docente revisa el análisis',
};

const fecha = (f?: string | null) => (f ? new Date(f).toLocaleDateString('es-EC') : '');

export default function Coordinacion() {
  const [lista, setLista] = useState<Resumen[] | null>(null);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [elegido, setElegido] = useState<Record<number, string>>({});
  const [filtro, setFiltro] = useState<Filtro>('sin');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargar = () => void api<Resumen[]>('/solicitudes/coordinacion').then(setLista).catch((e: Error) => setError(e.message));
  useEffect(() => {
    cargar();
    void api<Docente[]>('/identidad/docentes').then(setDocentes).catch(() => setDocentes([]));
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras);
  }, []);

  const nombre = (codigo: string) => carreras.find((c) => c.codigo === codigo)?.nombre ?? codigo;
  const grupo = (s: Resumen): Filtro => (s.estado === 'REVISADA' ? 'terminadas' : s.docenteId ? 'revision' : 'sin');
  const cuantas = (f: Filtro) => (lista ?? []).filter((s) => f === 'todas' || grupo(s) === f).length;
  const visibles = (lista ?? []).filter((s) => filtro === 'todas' || grupo(s) === filtro);

  const asignar = async (s: Resumen) => {
    const d = docentes.find((x) => String(x.id) === elegido[s.id]);
    if (!d) return;
    try {
      await api(`/solicitudes/coordinacion/${s.id}/docente`, { method: 'PUT', body: JSON.stringify({ docenteId: d.id, docente: d.nombre }) });
      setError('');
      setMensaje(`La solicitud N.º ${s.id} quedó asignada a ${d.nombre}.`);
      setElegido((e) => ({ ...e, [s.id]: '' }));
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const descargar = async (id: number) => {
    try {
      const pdf = await api<Blob>(`/documentos/informes/${id}`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdf);
      a.download = `informe-${id}.pdf`;
      a.click();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const FILTROS: [Filtro, string][] = [
    ['sin', 'Sin docente'],
    ['revision', 'En homologación'],
    ['terminadas', 'Recibidas'],
    ['todas', 'Todas'],
  ];

  return (
    <main>
      <div className="titulo-con-accion">
        <h1>Coordinación de homologaciones</h1>
        <Link className="boton" to="/coordinacion/nueva">
          + Registrar solicitud
        </Link>
      </div>
      <p className="ayuda">
        Registra las solicitudes que entregan los estudiantes y elige el <b>docente</b> que hará cada homologación (puedes cambiarlo mientras no te envíe
        el resultado). Cuando el docente termine, la verás en <b>Recibidas</b>.
      </p>
      {mensaje && <p className="aviso listo">✓ {mensaje}</p>}
      {error && <p role="alert">{error}</p>}
      {docentes.length === 0 && <p className="aviso alerta">No hay docentes. Pide al administrador que cree sus cuentas.</p>}
      <div className="filtros">
        {FILTROS.map(([f, texto]) => (
          <button key={f} className={filtro === f ? '' : 'pequeno'} onClick={() => setFiltro(f)}>
            {texto} ({cuantas(f)})
          </button>
        ))}
      </div>
      {!lista ? (
        <p className="vacio">Cargando…</p>
      ) : visibles.length === 0 ? (
        <p className="vacio">No hay solicitudes en este grupo.</p>
      ) : (
        <div className="tabla-record">
          <table>
            <thead>
              <tr>
                <th>N.º</th>
                <th>Estudiante</th>
                <th>Cambio</th>
                <th>Docente</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((s) => (
                <tr key={s.id}>
                  <td>{s.id}</td>
                  <td>
                    <strong>{s.estudiante ?? `Solicitud ${s.id}`}</strong>
                    <small className="equivale">
                      {s.tipo === 'EXTERNO' ? 'Otra universidad' : 'Estudiante de la UTA'} · {s._count?.materias ?? 0} materias
                    </small>
                  </td>
                  <td className="cambio">
                    {s.tipo === 'EXTERNO' ? `${s.universidadOrigen ?? ''} · ${s.carreraOrigen}` : nombre(s.carreraOrigen)} → <b>{nombre(s.carreraDestino)}</b>
                    <small className="equivale">{s.periodo}</small>
                  </td>
                  <td>
                    {s.estado === 'REVISADA' ? (
                      <>
                        <span className="etiqueta homologable">Recibida</span>
                        <small className="equivale">
                          {s.docente ? `${s.docente} · ${fecha(s.terminada)}` : 'Revisada antes de asignar docentes'}
                        </small>
                      </>
                    ) : (
                      <div className="asignar">
                        {s.docente && (
                          <small className="equivale">
                            Asignada a <b>{s.docente}</b> · {fecha(s.asignada)}
                            <br />
                            {ETAPA[s.estado]}
                          </small>
                        )}
                        <select value={elegido[s.id] ?? ''} onChange={(e) => setElegido({ ...elegido, [s.id]: e.target.value })}>
                          <option value="">{s.docente ? 'Cambiar docente…' : 'Elige el docente…'}</option>
                          {docentes
                            .filter((d) => d.id !== s.docenteId)
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.nombre}
                              </option>
                            ))}
                        </select>
                        <button className="pequeno" disabled={!elegido[s.id]} onClick={() => void asignar(s)}>
                          {s.docente ? 'Cambiar' : 'Asignar'}
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="botones-regla">
                    {['RESULTADO_LISTO', 'REVISADA'].includes(s.estado) && (
                      <>
                        <Link className="boton pequeno" to={`/coordinacion/${s.id}`}>
                          Ver
                        </Link>
                        <button className="pequeno" onClick={() => void descargar(s.id)}>
                          PDF
                        </button>
                      </>
                    )}
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
