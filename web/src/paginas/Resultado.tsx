import { useEffect, useState } from 'react';
import { api } from '../api';
import Pasos from '../componentes/Pasos';
import { notaConvertida } from '../notas';
import { armarFilas } from '../filas';

interface Causa {
  regla: string;
  cumple: boolean;
  causa: string;
}
interface Informe {
  nueva: string;
  causas: Causa[];
  temasFaltan: string[];
  parecido?: number;
  juntas?: string[]; // HU-26
  aviso?: string; // HU-26 · falta registrar la otra parte
}
interface Materia {
  codigo: string;
  nombre: string;
  codigoNueva: string | null;
  resultado: string | null;
  informe: string | null;
  nota: number;
  notaOriginal?: number | null;
  escala?: number | null;
  juntoCon?: string | null; // HU-26
  adicionales?: string | null; // HU-29
}
interface Solicitud {
  id: number;
  estado: string;
  tipo?: 'INTERNO' | 'EXTERNO';
  universidadOrigen?: string | null;
  carreraOrigen: string;
  carreraDestino: string;
  requisitos?: string | null; // T45 · revisión de RN-08 (solo EXTERNO)
  enviada?: string | null; // cuándo se mandó al agente
  materias: Materia[];
}

// Qué significa cada resultado (leyenda de la página)
const SIGNIFICADOS: [string, string][] = [
  ['Homologable', 'Cumple todas las reglas: se te podría reconocer.'],
  ['No homologable', 'No cumple al menos una regla. Pulsa «Ver por qué» para saber cuál.'],
  ['Pendiente', 'La inteligencia artificial no alcanzó a revisarla. Pulsa «Reintentar las pendientes».'],
  ['Sin materia equivalente', 'En la nueva carrera no hay una materia igual o parecida.'],
];

// 95 → "1:35"
const reloj = (segundos: number) => `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
interface Requisitos {
  cumple: boolean;
  causas: { requisito: string; cumple: boolean; causa: string }[];
}
interface Carrera {
  codigo: string;
  nombre: string;
}

// Texto de la columna "Se homologa por" cuando todavía no hay informe
const equivalente = (resultado: string | null, destino: string) => {
  if (resultado === 'Sin materia equivalente') return `No hay una materia igual en ${destino}`;
  if (resultado === 'Pendiente') return 'Por confirmar (reintenta)';
  return 'Buscando…';
};

// "No homologable" → "no-homologable" (para el color de la etiqueta)
const claseDe = (texto: string) =>
  texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ /g, '-');

export default function Resultado() {
  const [s, setS] = useState<Solicitud | null>(null);
  const [abierta, setAbierta] = useState('');
  const [version, setVersion] = useState(0); // cambia para volver a cargar
  const [error, setError] = useState('');
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [reintentando, setReintentando] = useState(false); // evita lanzar dos revisiones con dos clics
  const [ahora, setAhora] = useState(() => Date.now()); // para el reloj de la espera

  // Nombres de las carreras ("Software" en vez de "SW")
  useEffect(() => {
    void api<Carrera[]>('/catalogo/carreras')
      .then(setCarreras)
      .catch(() => undefined);
  }, []);
  const nombreCarrera = (codigo: string) => carreras.find(c => c.codigo === codigo)?.nombre ?? codigo;

  // Carga la solicitud y la vuelve a pedir cada 5 segundos mientras el agente trabaja
  useEffect(() => {
    let activo = true;
    const cargar = () =>
      api<Solicitud>('/solicitudes/mia').then(sol => {
        if (activo) setS(sol);
      });
    void cargar();
    const t = setInterval(() => void cargar(), 5000);
    return () => {
      activo = false;
      clearInterval(t);
    };
  }, [version]);

  // Reloj de la espera: avanza cada segundo mientras el agente trabaja
  const esperando = !!s && s.estado !== 'RESULTADO_LISTO';
  useEffect(() => {
    if (!esperando) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [esperando]);

  const reintentar = async () => {
    if (reintentando) return;
    setReintentando(true);
    setError('');
    try {
      await api(`/solicitudes/${s!.id}/reintentar`, { method: 'POST' });
      setVersion(v => v + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReintentando(false);
    }
  };

  const descargar = async () => {
    try {
      const pdf = await api<Blob>(`/documentos/informes/${s!.id}`);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(pdf);
      a.download = `informe-${s!.id}.pdf`;
      a.click();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  if (!s) {
    return (
      <main>
        <p className="vacio">Cargando…</p>
      </main>
    );
  }

  const listo = s.estado === 'RESULTADO_LISTO';
  const hayPendientes = s.materias.some(m => m.resultado === 'Pendiente');
  // HU-26 y HU-29 · una fila por cada materia nueva evaluada
  const filas = armarFilas(s.materias);
  // Resumen en una frase: cuántas materias de la nueva carrera se le reconocerían
  const reconocidas = new Set(filas.filter(f => f.resultado === 'Homologable').map(f => f.codigoNueva ?? f.clave)).size;
  const noCumplen = filas.filter(f => f.resultado === 'No homologable').length;
  const sinEquivalente = filas.filter(f => f.resultado === 'Sin materia equivalente').length;
  const pendientes = filas.filter(f => f.resultado === 'Pendiente').length;
  // Espera: desde cuándo revisa el agente y cuánto suele tardar (aprox. 1 minuto y medio por materia)
  const transcurrido = s.enviada ? Math.max(0, Math.round((ahora - new Date(s.enviada).getTime()) / 1000)) : null;
  const estimado = Math.max(2, Math.ceil(s.materias.length * 1.5));
  // T49 · Solicitud de otra universidad: columna "Parecido" y aviso de RN-08
  const externo = s.tipo === 'EXTERNO';
  const requisitos = externo && s.requisitos ? (JSON.parse(s.requisitos) as Requisitos) : null;
  const origen = externo ? (s.universidadOrigen ?? 'otra universidad') : nombreCarrera(s.carreraOrigen);

  return (
    <main>
      <h1>Resultado de tu solicitud</h1>
      <p className="ayuda">Este es un análisis previo. La decisión oficial la toma el Consejo Directivo de la Facultad.</p>
      <Pasos actual={listo ? 4 : 3} />

      {!listo && (
        <div className="espera">
          <div className="espera-titulo">
            <span className="girando" aria-hidden="true" />
            <strong>
              El agente está revisando {s.materias.length === 1 ? 'tu materia' : `tus ${s.materias.length} materias`}
            </strong>
            {transcurrido !== null && <span className="reloj">{reloj(transcurrido)}</span>}
          </div>
          <div className="barra-espera" aria-hidden="true">
            <span />
          </div>
          <ol className="espera-pasos">
            <li>Busca la materia equivalente en {nombreCarrera(s.carreraDestino)}</li>
            <li>Compara los temas con inteligencia artificial (RN-01)</li>
            <li>Revisa créditos, horas, nota y años (RN-02 a RN-05)</li>
            <li>Arma tu informe</li>
          </ol>
          <p>
            Suele tardar unos {estimado} minutos. Esta página se actualiza sola; también puedes cerrarla y volver después: tu resultado queda
            guardado.
          </p>
          {transcurrido !== null && transcurrido > estimado * 60 * 2 && (
            <p className="alerta-texto">
              Está tardando más de lo normal: la inteligencia artificial puede estar muy ocupada. Espera un poco más; si alguna materia queda
              «Pendiente», pulsa «Reintentar las pendientes».
            </p>
          )}
        </div>
      )}

      {listo && (
        <div className="resumen-final">
          <strong>
            {reconocidas > 0
              ? `Se te podrían reconocer ${reconocidas} ${reconocidas === 1 ? 'materia' : 'materias'} de ${nombreCarrera(s.carreraDestino)}.`
              : `Por ahora no se te reconocería ninguna materia de ${nombreCarrera(s.carreraDestino)}.`}
          </strong>
          <span>
            {[
              noCumplen > 0 && `${noCumplen} no ${noCumplen === 1 ? 'cumple' : 'cumplen'} alguna regla`,
              sinEquivalente > 0 && `${sinEquivalente} sin materia equivalente`,
              pendientes > 0 && `${pendientes} ${pendientes === 1 ? 'quedó pendiente' : 'quedaron pendientes'}`,
            ]
              .filter(Boolean)
              .join(' · ') || 'Todas tus materias cumplen las reglas.'}
          </span>
        </div>
      )}

      {listo && requisitos && (
        <div className={`aviso ${requisitos.cumple ? 'listo' : 'alerta'}`}>
          <strong>
            {requisitos.cumple
              ? '✓ Cumples los requisitos para cambiarte desde otra universidad (RN-08).'
              : '✗ Todavía no cumples los requisitos para cambiarte desde otra universidad (RN-08).'}
          </strong>
          <ul className="requisitos">
            {requisitos.causas.map(c => (
              <li key={c.requisito} className={c.cumple ? 'cumple' : 'no-cumple'}>
                <b>{c.requisito}:</b> {c.cumple ? 'Cumple' : 'No cumple'} · {c.causa}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="conteo">
        {[
          ['Homologable', 'homologable'],
          ['No homologable', 'no-homologable'],
          ['Pendiente', 'pendiente'],
          ['Sin materia equivalente', 'sin-materia-equivalente'],
        ].map(([texto, clase]) => {
          const n = filas.filter(f => f.resultado === texto).length;
          return n > 0 ? (
            <div key={clase} className={`conteo-item ${clase}`}>
              <strong>{n}</strong>
              <span>{texto}</span>
            </div>
          ) : null;
        })}
      </div>

      <table className="tabla-resultado">
        <thead>
          <tr>
            <th>Tu materia ({origen})</th>
            <th>Se homologa por ({nombreCarrera(s.carreraDestino)})</th>
            {externo && <th title="Qué tanto se parecen los temas de tu sílabo a los de la materia de la FISEI">Parecido</th>}
            <th>Resultado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filas.map(f => {
            const inf = f.informe ? (JSON.parse(f.informe) as Informe) : null;
            const resultado = f.resultado ?? 'En revisión';
            const juntas = f.materias.length > 1;
            return (
              <tr key={f.clave} className={f.tambien ? 'tambien' : undefined}>
                <td>
                  {f.tambien && <small className="etiqueta-fila">También cubre</small>}
                  {juntas && <small className="etiqueta-fila">Evaluadas juntas</small>}
                  {f.materias.map((m, i) => (
                    <div key={m.codigo} className="materia-de-fila">
                      <strong>
                        {i > 0 && '+ '}
                        {m.nombre}
                      </strong>
                      <small className="equivale">{m.codigo}</small>
                      {notaConvertida(m) && <small className="nota-convertida">Nota: {notaConvertida(m)}</small>}
                    </div>
                  ))}
                  {abierta === f.clave && inf && (
                    <ul className="detalle">
                      {inf.causas.map(c => (
                        <li key={c.regla} className={c.cumple ? 'cumple' : 'no-cumple'}>
                          <b>{c.regla}:</b> {c.cumple ? 'Cumple' : 'No cumple'} · {c.causa}
                        </li>
                      ))}
                      {inf.temasFaltan.length > 0 && (
                        <li className="faltan">
                          <b>Temas que faltan:</b> {inf.temasFaltan.join(', ')}
                        </li>
                      )}
                      {inf.aviso && (
                        <li className="faltan">
                          <b>Ojo:</b> {inf.aviso}
                        </li>
                      )}
                    </ul>
                  )}
                </td>
                <td>
                  {inf ? (
                    <>
                      <strong>{inf.nueva.replace(/ \(.*\)$/, '')}</strong>
                      <small className="equivale">{f.codigoNueva ?? inf.nueva.match(/\((.*)\)$/)?.[1]}</small>
                    </>
                  ) : (
                    <span className="sin-equivalente">{equivalente(f.resultado, nombreCarrera(s.carreraDestino))}</span>
                  )}
                </td>
                {externo && <td className="parecido">{inf?.parecido !== undefined ? `${inf.parecido} %` : '—'}</td>}
                <td>
                  <span className={`etiqueta ${claseDe(resultado)}`}>{resultado}</span>
                </td>
                <td>
                  {inf && (
                    <button className="pequeno" onClick={() => setAbierta(abierta === f.clave ? '' : f.clave)}>
                      {abierta === f.clave ? 'Ocultar' : 'Ver por qué'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <details className="leyenda">
        <summary>¿Qué significa cada resultado?</summary>
        <ul>
          {SIGNIFICADOS.map(([texto, significado]) => (
            <li key={texto}>
              <span className={`etiqueta ${claseDe(texto)}`}>{texto}</span> {significado}
            </li>
          ))}
        </ul>
      </details>

      {error && <p role="alert">{error}</p>}

      {listo && (
        <div className="guia">
          <strong>¿Y ahora qué?</strong>
          <ol>
            <li>Descarga tu informe en PDF con el botón de abajo.</li>
            <li>Preséntalo junto con tu trámite de cambio de carrera.</li>
            <li>El Consejo Directivo de la Facultad toma la decisión oficial; este informe es un análisis previo.</li>
          </ol>
        </div>
      )}

      <div className="acciones">
        {hayPendientes && (
          <button className="pequeno" onClick={() => void reintentar()} disabled={reintentando}>
            {reintentando ? 'Enviando…' : 'Reintentar las pendientes'}
          </button>
        )}
        <button onClick={() => void descargar()} disabled={!listo}>
          Descargar informe en PDF
        </button>
      </div>
    </main>
  );
}
