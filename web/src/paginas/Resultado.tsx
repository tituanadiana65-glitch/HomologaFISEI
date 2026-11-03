import { useEffect, useState } from 'react';
import { api } from '../api';
import Pasos from '../componentes/Pasos';

interface Causa { regla: string; cumple: boolean; causa: string }
interface Informe { nueva: string; causas: Causa[]; temasFaltan: string[] }
interface Materia { codigo: string; nombre: string; codigoNueva: string | null; resultado: string | null; informe: string | null }
interface Solicitud { id: number; estado: string; carreraOrigen: string; carreraDestino: string; materias: Materia[] }
interface Carrera { codigo: string; nombre: string }

// Texto de la columna "Se homologa por" cuando todavía no hay informe
const equivalente = (resultado: string | null, destino: string) => {
  if (resultado === 'Sin materia equivalente') return `No hay una materia igual en ${destino}`;
  if (resultado === 'Pendiente') return 'Por confirmar (reintenta)';
  return 'Buscando…';
};

// "No homologable" → "no-homologable" (para el color de la etiqueta)
const claseDe = (texto: string) =>
  texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ /g, '-');

export default function Resultado() {
  const [s, setS] = useState<Solicitud | null>(null);
  const [abierta, setAbierta] = useState('');
  const [version, setVersion] = useState(0); // cambia para volver a cargar
  const [error, setError] = useState('');
  const [carreras, setCarreras] = useState<Carrera[]>([]);

  // Nombres de las carreras ("Software" en vez de "SW")
  useEffect(() => {
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras).catch(() => undefined);
  }, []);
  const nombreCarrera = (codigo: string) => carreras.find((c) => c.codigo === codigo)?.nombre ?? codigo;

  // Carga la solicitud y la vuelve a pedir cada 5 segundos mientras el agente trabaja
  useEffect(() => {
    let activo = true;
    const cargar = () =>
      api<Solicitud>('/solicitudes/mia').then((sol) => {
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
    try {
      await api(`/solicitudes/${s!.id}/reintentar`, { method: 'POST' });
      setVersion((v) => v + 1);
    } catch (err) {
      setError((err as Error).message);
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
  const hayPendientes = s.materias.some((m) => m.resultado === 'Pendiente');

  return (
    <main>
      <h1>Resultado de tu solicitud</h1>
      <Pasos actual={listo ? 4 : 3} />

      {!listo && <p className="aviso">⏳ El agente está revisando tus materias. Esta página se actualiza sola.</p>}
      {listo && <p className="aviso listo">✓ Tu resultado está listo. Puedes descargar el informe en PDF.</p>}

      <table>
        <thead>
          <tr>
            <th>Tu materia ({nombreCarrera(s.carreraOrigen)})</th>
            <th>Se homologa por ({nombreCarrera(s.carreraDestino)})</th>
            <th>Resultado</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {s.materias.map((m) => {
            const inf = m.informe ? (JSON.parse(m.informe) as Informe) : null;
            const resultado = m.resultado ?? 'En revisión';
            return (
              <tr key={m.codigo}>
                <td>
                  <strong>{m.nombre}</strong>
                  <small className="equivale">{m.codigo}</small>
                  {abierta === m.codigo && inf && (
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
                </td>
                <td>
                  {inf ? (
                    <>
                      <strong>{inf.nueva.replace(/ \(.*\)$/, '')}</strong>
                      <small className="equivale">{m.codigoNueva ?? inf.nueva.match(/\((.*)\)$/)?.[1]}</small>
                    </>
                  ) : (
                    <span className="sin-equivalente">{equivalente(m.resultado, nombreCarrera(s.carreraDestino))}</span>
                  )}
                </td>
                <td>
                  <span className={`etiqueta ${claseDe(resultado)}`}>{resultado}</span>
                </td>
                <td>
                  {inf && (
                    <button className="pequeno" onClick={() => setAbierta(abierta === m.codigo ? '' : m.codigo)}>
                      {abierta === m.codigo ? 'Ocultar' : 'Ver detalle'}
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
          <button className="pequeno" onClick={() => void reintentar()}>
            Reintentar las pendientes
          </button>
        )}
        <button onClick={() => void descargar()} disabled={!listo}>
          Descargar informe en PDF
        </button>
      </div>
    </main>
  );
}