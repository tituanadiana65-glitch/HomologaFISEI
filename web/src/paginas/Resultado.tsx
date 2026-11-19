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
  materias: Materia[];
}
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
  // T49 · Solicitud de otra universidad: columna "Parecido" y aviso de RN-08
  const externo = s.tipo === 'EXTERNO';
  const requisitos = externo && s.requisitos ? (JSON.parse(s.requisitos) as Requisitos) : null;
  const origen = externo ? (s.universidadOrigen ?? 'otra universidad') : nombreCarrera(s.carreraOrigen);

  return (
    <main>
      <h1>Resultado de tu solicitud</h1>
      <p className="ayuda">Este es un análisis previo. La decisión oficial la toma el Consejo Directivo de la Facultad.</p>
      <Pasos actual={listo ? 4 : 3} />

      {!listo && <p className="aviso">⏳ El agente está revisando tus materias. Esta página se actualiza sola.</p>}
      {listo && <p className="aviso listo">✓ Tu resultado está listo. Puedes descargar el informe en PDF.</p>}

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
                      {abierta === f.clave ? 'Ocultar' : 'Ver detalle'}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {error && <p role="alert">{error}</p>}

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
