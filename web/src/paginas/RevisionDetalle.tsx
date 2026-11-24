import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Pasos from '../componentes/Pasos';
import { api } from '../api';
import { armarFilas } from '../filas';
import { notaConvertida } from '../notas';

// El docente asignado hace la homologación: revisa el análisis del agente, cambia resultados con comentario y la termina
interface Causa { regla: string; cumple: boolean; causa: string }
interface Informe { nueva: string; resultado: string; causas: Causa[]; temasFaltan: string[]; parecido?: number; aviso?: string }
interface Materia {
  codigo: string;
  nombre: string;
  nota: number;
  notaOriginal?: number | null;
  escala?: number | null;
  codigoNueva: string | null;
  resultado: string | null;
  informe: string | null;
  juntoCon?: string | null;
  resultadoDocente?: string | null;
  comentarioDocente?: string | null;
  docenteCambio?: string | null;
}
interface Solicitud {
  id: number;
  tipo?: string;
  estado: string;
  estudiante?: string | null;
  universidadOrigen?: string | null;
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
  requisitos?: string | null;
  coordinador?: string | null;
  terminada?: string | null;
  comentarioFinal?: string | null;
  materias: Materia[];
}
interface Carrera { codigo: string; nombre: string }

const RESULTADOS = ['Homologable', 'No homologable', 'Sin materia equivalente'];
const claseDe = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-');

export default function RevisionDetalle() {
  const { id } = useParams();
  const [s, setS] = useState<Solicitud | null>(null);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [abierta, setAbierta] = useState('');
  const [editando, setEditando] = useState<{ codigo: string; resultado: string; comentario: string } | null>(null);
  const [comentario, setComentario] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    void api<Solicitud>(`/solicitudes/revision/${id}`).then(setS).catch((e: Error) => setError(e.message));
  }, [id]);
  useEffect(() => {
    cargar();
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras);
  }, [cargar]);

  const nombre = (codigo: string) => carreras.find((c) => c.codigo === codigo)?.nombre ?? codigo;

  const guardarCambio = async () => {
    if (!editando) return;
    try {
      await api(`/solicitudes/revision/${id}/materias/${encodeURIComponent(editando.codigo)}`, {
        method: 'PUT',
        body: JSON.stringify({ resultado: editando.resultado, comentario: editando.comentario }),
      });
      setEditando(null);
      setError('');
      setMensaje('Se guardó el cambio.');
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const terminar = async () => {
    try {
      await api(`/solicitudes/revision/${id}/terminar`, { method: 'POST', body: JSON.stringify({ comentario }) });
      setComentario('');
      setError('');
      setMensaje('Enviaste el resultado al coordinador.');
      cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const descargar = async () => {
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

  if (!s) return <main>{error ? <p role="alert">{error}</p> : <p className="vacio">Cargando…</p>}</main>;

  const filas = armarFilas(s.materias);
  const revisada = s.estado === 'REVISADA';
  const requisitos = s.tipo === 'EXTERNO' && s.requisitos ? (JSON.parse(s.requisitos) as { cumple: boolean; causas: { requisito: string; cumple: boolean; causa: string }[] }) : null;

  return (
    <main>
      <p>
        <Link className="volver" to="/revision">
          ← Volver a mis homologaciones
        </Link>
      </p>
      <h1>Homologación N.º {s.id}</h1>
      <p className="ayuda">
        <b>{s.estudiante ?? 'Estudiante'}</b> ·{' '}
        {s.tipo === 'EXTERNO' ? `${s.universidadOrigen ?? ''} · ${s.carreraOrigen}` : nombre(s.carreraOrigen)} → <b>{nombre(s.carreraDestino)}</b> · {s.periodo}
        {s.coordinador && <> · Asignada por {s.coordinador}</>}
      </p>

      <Pasos actual={revisada ? 5 : 3} />
      {mensaje && <p className="aviso listo">✓ {mensaje}</p>}
      {error && <p role="alert">{error}</p>}

      {requisitos && (
        <div className={`aviso ${requisitos.cumple ? 'listo' : 'alerta'}`}>
          <b>RN-08 · {requisitos.cumple ? 'Cumple' : 'No cumple'}</b> los requisitos para cambiarse desde otra universidad:{' '}
          {requisitos.causas.map((c) => c.causa).join(' · ')}
        </div>
      )}

      <div className="tabla-record">
        <table>
          <thead>
            <tr>
              <th>Materia aprobada</th>
              <th>Se homologa por ({nombre(s.carreraDestino)})</th>
              <th>Agente</th>
              <th>Resultado final</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const inf = f.informe ? (JSON.parse(f.informe) as Informe) : null;
              const enEdicion = editando?.codigo === f.clave;
              return (
                <tr key={f.clave}>
                  <td>
                    {f.materias.length > 1 && <small className="etiqueta-fila">Evaluadas juntas</small>}
                    {f.materias.map((m, i) => (
                      <div key={m.codigo}>
                        <strong>
                          {i > 0 && '+ '}
                          {m.nombre}
                        </strong>
                        {notaConvertida(m) && <small className="equivale">Nota: {notaConvertida(m)}</small>}
                      </div>
                    ))}
                    {abierta === f.clave && inf && (
                      <ul className="detalle">
                        {inf.causas.map((c) => (
                          <li key={c.regla} className={c.cumple ? 'cumple' : 'no-cumple'}>
                            <b>{c.regla}:</b> {c.cumple ? 'Cumple' : 'No cumple'} · {c.causa}
                          </li>
                        ))}
                        {inf.temasFaltan.length > 0 && (
                          <li className="faltan">
                            <b>Temas que faltan:</b> {inf.temasFaltan.join(', ')}
                          </li>
                        )}
                      </ul>
                    )}
                    {f.docenteCambio && f.resultado !== f.resultadoAgente && (
                      <small className="cambio-docente">
                        <b>Cambiado por {f.docenteCambio}:</b> {f.comentarioDocente}
                      </small>
                    )}
                    {enEdicion && (
                      <div className="editar-resultado">
                        <label>
                          Nuevo resultado
                          <select value={editando.resultado} onChange={(e) => setEditando({ ...editando, resultado: e.target.value })}>
                            {RESULTADOS.map((r) => (
                              <option key={r}>{r}</option>
                            ))}
                          </select>
                        </label>
                        <label>
                          Comentario (obligatorio)
                          <textarea
                            rows={2}
                            value={editando.comentario}
                            placeholder="Por ejemplo: revisé el sílabo y la unidad 3 no se cubre"
                            onChange={(e) => setEditando({ ...editando, comentario: e.target.value })}
                          />
                        </label>
                        <div className="acciones">
                          <button className="pequeno" disabled={editando.comentario.trim().length < 5} onClick={() => void guardarCambio()}>
                            Guardar cambio
                          </button>
                          <button className="enlace" onClick={() => setEditando(null)}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    {inf ? <strong>{inf.nueva.replace(/ \(.*\)$/, '')}</strong> : '—'}
                    {inf?.parecido !== undefined && <small className="equivale">Parecido {inf.parecido} %</small>}
                  </td>
                  <td>
                    <span className={`etiqueta ${claseDe(f.resultadoAgente ?? 'En revisión')}`}>{f.resultadoAgente ?? '—'}</span>
                  </td>
                  <td>
                    <span className={`etiqueta ${claseDe(f.resultado ?? 'En revisión')}`}>{f.resultado ?? '—'}</span>
                  </td>
                  <td className="botones-regla">
                    {inf && (
                      <button className="pequeno" onClick={() => setAbierta(abierta === f.clave ? '' : f.clave)}>
                        {abierta === f.clave ? 'Ocultar' : 'Ver por qué'}
                      </button>
                    )}
                    {!revisada && !enEdicion && (
                      <button
                        className="pequeno"
                        onClick={() => setEditando({ codigo: f.clave, resultado: f.resultado && f.resultado !== 'Pendiente' ? f.resultado : 'Homologable', comentario: '' })}
                      >
                        Cambiar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="aprobar">
        <h2>Enviar el resultado al coordinador</h2>
        {revisada ? (
          <p className="aviso listo">
            ✓ Enviaste el resultado al coordinador el {s.terminada ? new Date(s.terminada).toLocaleString('es-EC') : ''}
            {s.comentarioFinal && <> · «{s.comentarioFinal}»</>}
          </p>
        ) : (
          <>
            <p className="ayuda">
              Cuando estés de acuerdo con todos los resultados, envía al coordinador lo homologable y lo no homologable. Después ya no se pueden
              cambiar.
            </p>
            <label>
              Comentario para el coordinador (opcional)
              <textarea rows={2} value={comentario} onChange={(e) => setComentario(e.target.value)} />
            </label>
            <div className="acciones">
              <button onClick={() => void terminar()}>Enviar al coordinador</button>
            </div>
          </>
        )}
      </section>

      <div className="acciones">
        <button onClick={() => void descargar()}>Descargar informe en PDF</button>
      </div>
    </main>
  );
}
