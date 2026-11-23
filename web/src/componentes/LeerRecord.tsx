import { useState } from 'react';
import { api } from '../api';
import SubirPdf from './SubirPdf';
import { numero } from '../notas';

// Observación del docente (22/11/2026): el sistema lee el récord académico para saber qué materias aprobó
// (y cuáles reprobó) y no tener que escribir todo a mano. El estudiante revisa la lista y agrega las que quiera.
type Estado = 'APROBADA' | 'REPROBADA' | 'CURSANDO';
interface MateriaRecord {
  nombre: string;
  creditos: number | null;
  horas: number | null;
  nota: number | null;
  escala: number | null;
  anio: number | null;
  periodo: string | null;
  estado: Estado;
  veces: number;
  codigo?: string | null; // UTA
  nivel?: string | null;
  docente?: string | null;
}
interface Lectura {
  materias: MateriaRecord[];
  aprobadas: number;
  reprobadas: number;
}
interface Fila extends MateriaRecord {
  elegida: boolean;
  silaboId?: number;
  creditosTxt: string;
  horasTxt: string;
  aviso?: string;
}

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim();
const ESTADO_TEXTO: Record<Estado, string> = { APROBADA: 'Aprobada', REPROBADA: 'Reprobada', CURSANDO: 'En curso' };

export default function LeerRecord({
  solicitudId,
  externo,
  recordId,
  carreraOrigen,
  nombreCarreraOrigen,
  registradas,
  alTerminar,
}: {
  solicitudId: number;
  externo: boolean;
  recordId?: number | null; // otra universidad: el récord ya se subió al crear la solicitud
  carreraOrigen: string;
  nombreCarreraOrigen: string;
  registradas: { codigo: string; nombre: string }[];
  alTerminar: () => void;
}) {
  const [idUta, setIdUta] = useState<number | undefined>();
  const [leyendo, setLeyendo] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const documentoId = externo ? recordId : idUta;
  const yaRegistrada = (m: MateriaRecord) =>
    registradas.some((r) => (m.codigo ? r.codigo === m.codigo : normalizar(r.nombre) === normalizar(m.nombre)));
  // Solo se pueden agregar las aprobadas; de la UTA, además, que estén en la malla de su carrera
  const sePuede = (m: MateriaRecord) => m.estado === 'APROBADA' && !yaRegistrada(m) && (externo || !!m.codigo);

  const leer = async () => {
    if (!documentoId) return;
    setLeyendo(true);
    setError('');
    setMensaje('');
    try {
      const r = await api<Lectura>('/agente/leer-record', {
        method: 'POST',
        body: JSON.stringify({ documentoId, ...(externo ? {} : { carreraOrigen }) }),
      });
      setFilas(
        r.materias.map((m) => ({
          ...m,
          elegida: sePuede(m),
          creditosTxt: m.creditos?.toString() ?? '',
          horasTxt: m.horas?.toString() ?? '',
        })),
      );
      setMensaje(
        `Encontramos ${r.materias.length} materias en tu récord: ${r.aprobadas} ${r.aprobadas === 1 ? 'aprobada' : 'aprobadas'}` +
          (r.reprobadas ? ` y ${r.reprobadas} ${r.reprobadas === 1 ? 'reprobada' : 'reprobadas'} (no se pueden homologar)` : '') +
          '. Revisa la lista y agrega las que quieras homologar.',
      );
    } catch (e) {
      setError(`No se pudo leer el récord: ${(e as Error).message}. Puedes intentarlo otra vez o registrar las materias a mano.`);
    } finally {
      setLeyendo(false);
    }
  };

  const cambiar = (i: number, cambio: Partial<Fila>) => setFilas((f) => f!.map((x, j) => (j === i ? { ...x, ...cambio } : x)));

  // Lo que falta en una fila elegida para poder agregarla
  const falta = (f: Fila) =>
    externo
      ? [!f.silaboId && 'sílabo', !(Number(f.creditosTxt) > 0) && 'créditos', !(Number(f.horasTxt) > 0) && 'horas', f.nota === null && 'nota', !f.anio && 'año'].filter(Boolean)
      : [f.nota === null && 'nota', !f.anio && 'año'].filter(Boolean);

  const elegidas = (filas ?? []).filter((f) => f.elegida);
  const listas = elegidas.filter((f) => falta(f).length === 0);

  const agregar = async () => {
    setAgregando(true);
    setError('');
    let bien = 0;
    const nuevas = [...filas!];
    for (const f of listas) {
      const i = nuevas.indexOf(f);
      try {
        if (externo) {
          await api(`/solicitudes/${solicitudId}/materias-externas`, {
            method: 'POST',
            body: JSON.stringify({
              nombre: f.nombre,
              creditos: Number(f.creditosTxt),
              horas: Number(f.horasTxt),
              nota: f.nota,
              escala: f.escala ?? 10,
              anio: f.anio,
              silaboId: f.silaboId,
            }),
          });
        } else {
          await api(`/solicitudes/${solicitudId}/materias`, {
            method: 'POST',
            body: JSON.stringify({
              codigo: f.codigo,
              nivel: f.nivel,
              paralelo: '-',
              docente: f.docente || '-',
              periodo: f.periodo || '-',
              anio: f.anio,
              nota: Math.round(((f.nota ?? 0) * 10) / (f.escala ?? 10) * 100) / 100,
              matricula: Math.min(3, Math.max(1, f.veces)),
            }),
          });
        }
        bien++;
        nuevas[i] = { ...f, elegida: false, aviso: '✓ Agregada' };
      } catch (e) {
        nuevas[i] = { ...f, aviso: (e as Error).message };
      }
    }
    setFilas(nuevas);
    setAgregando(false);
    if (bien) {
      setMensaje(`Se agregaron ${bien} ${bien === 1 ? 'materia' : 'materias'} desde tu récord.`);
      alTerminar();
    }
  };

  return (
    <section className="leer-record">
      <h2>Llenar desde tu récord académico</h2>
      <p className="ayuda">
        La inteligencia artificial lee tu récord y arma la lista de materias que <b>cursaste</b>, con las que <b>aprobaste</b> y las que{' '}
        <b>reprobaste</b>. Solo revisas y agregas{externo ? ' (y subes el sílabo de cada una)' : ''}. Si prefieres, más abajo puedes registrarlas una
        por una.
      </p>
      <div className="leer-record-accion">
        {!externo && (
          <SubirPdf etiqueta="Tu récord académico (PDF)" tipo="RECORD" alSubir={setIdUta} pista="El que descargas del sistema académico de la UTA." />
        )}
        <button type="button" onClick={() => void leer()} disabled={!documentoId || leyendo}>
          {leyendo ? 'Leyendo tu récord…' : filas ? 'Volver a leer' : 'Leer mi récord'}
        </button>
        {externo && !recordId && <small className="pista alerta">Tu solicitud no tiene récord. Regístralas a mano más abajo.</small>}
        {leyendo && <small className="pista">La inteligencia artificial está leyendo tu récord: puede tardar hasta un minuto.</small>}
      </div>
      {error && <p role="alert">{error}</p>}
      {mensaje && <p className="aviso listo">{mensaje}</p>}

      {filas && filas.length > 0 && (
        <>
          <div className="tabla-record">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Materia</th>
                  <th>Nota</th>
                  <th>Estado</th>
                  {externo ? (
                    <>
                      <th>Créditos</th>
                      <th>Horas</th>
                      <th>Sílabo (PDF)</th>
                    </>
                  ) : (
                    <th>En la malla de {nombreCarreraOrigen}</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  const puede = sePuede(f);
                  const motivo =
                    f.estado !== 'APROBADA'
                      ? f.estado === 'REPROBADA'
                        ? 'Reprobada: no se puede homologar'
                        : 'En curso: aún no está aprobada'
                      : yaRegistrada(f)
                        ? 'Ya está registrada'
                        : !externo && !f.codigo
                          ? `No está en la malla de ${nombreCarreraOrigen}`
                          : '';
                  return (
                    <tr key={`${f.nombre}-${i}`} className={puede ? undefined : 'apagada'}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Agregar ${f.nombre}`}
                          checked={f.elegida}
                          disabled={!puede || agregando}
                          onChange={(e) => cambiar(i, { elegida: e.target.checked })}
                        />
                      </td>
                      <td>
                        <strong>{f.nombre}</strong>
                        <small className="equivale">
                          {[f.periodo ?? (f.anio ? String(f.anio) : null), f.veces > 1 ? `la cursó ${f.veces} veces` : null].filter(Boolean).join(' · ')}
                        </small>
                        {(motivo || f.aviso) && <small className={f.aviso?.startsWith('✓') ? 'pista bien' : 'pista alerta'}>{f.aviso ?? motivo}</small>}
                        {f.elegida && falta(f).length > 0 && <small className="pista alerta">Falta: {falta(f).join(', ')}</small>}
                      </td>
                      <td>{f.nota !== null ? `${numero(f.nota, 1)}${f.escala && f.escala !== 10 ? ` / ${f.escala}` : ''}` : '—'}</td>
                      <td>
                        <span className={`etiqueta ${f.estado === 'APROBADA' ? 'homologable' : f.estado === 'REPROBADA' ? 'no-homologable' : 'pendiente'}`}>
                          {ESTADO_TEXTO[f.estado]}
                        </span>
                      </td>
                      {externo ? (
                        <>
                          <td>
                            <input className="corto" type="number" min={0} value={f.creditosTxt} disabled={!puede} onChange={(e) => cambiar(i, { creditosTxt: e.target.value })} />
                          </td>
                          <td>
                            <input className="corto" type="number" min={0} value={f.horasTxt} disabled={!puede} onChange={(e) => cambiar(i, { horasTxt: e.target.value })} />
                          </td>
                          <td>{puede && <SubirPdf etiqueta="" tipo="SILABO" alSubir={(id) => cambiar(i, { silaboId: id })} />}</td>
                        </>
                      ) : (
                        <td>{f.codigo ? <small className="equivale">{f.nivel}</small> : '—'}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="acciones">
            <button type="button" onClick={() => void agregar()} disabled={!listas.length || agregando}>
              {agregando ? 'Agregando…' : `Agregar ${listas.length} ${listas.length === 1 ? 'materia' : 'materias'}`}
            </button>
            {elegidas.length > listas.length && (
              <small className="pista alerta">
                {elegidas.length - listas.length} elegidas aún no tienen todos sus datos{externo ? ' (por ejemplo, el sílabo)' : ''}.
              </small>
            )}
          </div>
        </>
      )}
    </section>
  );
}
