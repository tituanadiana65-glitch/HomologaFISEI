import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Pasos from '../componentes/Pasos';
import SubirPdf from '../componentes/SubirPdf';
import LeerRecord from '../componentes/LeerRecord';
import { numero } from '../notas';

interface Carrera { codigo: string; nombre: string }
interface Asignatura { codigo: string; nombre: string; docente: string }
interface Materia {
  codigo: string;
  nombre: string;
  nivel: string;
  nota: number;
  creditos?: number | null;
  horas?: number | null;
  notaOriginal?: number | null;
  escala?: number | null;
}
interface Solicitud {
  id: number;
  estado: string;
  tipo?: string;
  universidadOrigen?: string | null;
  carreraOrigen: string;
  carreraDestino: string;
  periodo: string;
  recordId?: number | null;
  materias: Materia[];
}

const vacia = { codigo: '', paralelo: 'A', docente: '', periodo: '', anio: 2025, nota: 7, matricula: 1 };
// Los números empiezan vacíos ('') para que no parezcan datos ya escritos
type Num = number | '';
const vaciaExterna = { nombre: '', creditos: '' as Num, horas: '' as Num, nota: '' as Num, escala: 20, anio: '' as Num };
const num = (v: string): Num => (v === '' ? '' : Number(v));
const ANIO_ACTUAL = new Date().getFullYear();

// Vista previa de la nota de otra universidad en la escala de la UTA (misma cuenta que ms-solicitudes)
function vistaNota(nota: Num, escala: number): { texto: string; alerta: boolean } | null {
  if (nota === '') return null;
  if (nota < 0 || nota > escala) return { texto: `La nota debe estar entre 0 y ${escala}.`, alerta: true };
  const uta = Math.round(((nota * 10) / escala) * 100) / 100;
  return uta < 7
    ? { texto: `Equivale a ${numero(uta, 1)} / 10 en la UTA: no alcanza la nota mínima de 7 (RN-04).`, alerta: true }
    : { texto: `Equivale a ${numero(uta, 1)} / 10 en la UTA.`, alerta: false };
}

export default function Materias() {
  const [s, setS] = useState<Solicitud | null>(null);
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [niveles, setNiveles] = useState<string[]>([]);
  const [nivel, setNivel] = useState('');
  const [asignaturas, setAsignaturas] = useState<Asignatura[]>([]);
  const [m, setM] = useState(vacia);
  const [mx, setMx] = useState(vaciaExterna); // materia de otra universidad
  const [silaboId, setSilaboId] = useState<number>();
  const [claveSilabo, setClaveSilabo] = useState(0); // cambia para limpiar el campo del sílabo
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0); // cambia para volver a cargar la solicitud
  const ir = useNavigate();

  const externo = s?.tipo === 'EXTERNO';
  const recargar = () => setVersion((v) => v + 1);
  const nombreCarrera = (codigo: string) => carreras.find((c) => c.codigo === codigo)?.nombre ?? codigo;

  // Nombres de las carreras (para mostrar "Tecnologías de la Información" en vez de "TI")
  useEffect(() => {
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras);
  }, []);

  // Carga la solicitud del estudiante y, si es de la UTA, los niveles de su carrera de origen
  useEffect(() => {
    let activo = true;
    void (async () => {
      const sol = await api<Solicitud | null>('/solicitudes/mia');
      if (!activo) return;
      if (!sol) return ir('/solicitud');
      if (sol.estado !== 'BORRADOR') return ir('/resultado');
      setS(sol);
      if (sol.tipo === 'EXTERNO') return;
      const lista = await api<string[]>(`/catalogo/niveles?carrera=${sol.carreraOrigen}`);
      if (activo) setNiveles(lista);
    })();
    return () => {
      activo = false;
    };
  }, [ir, version]);

  // Carga las materias del nivel elegido (solo UTA)
  useEffect(() => {
    if (s && !externo && nivel) {
      void api<Asignatura[]>(
        `/catalogo/asignaturas?carrera=${s.carreraOrigen}&nivel=${encodeURIComponent(nivel)}`,
      ).then(setAsignaturas);
    }
  }, [s, externo, nivel]);

  // Lo que falta en cada formulario (el botón "Agregar materia" se activa cuando no falta nada)
  const faltanUta = [!nivel && 'el nivel', !m.codigo && 'la materia', !m.docente.trim() && 'el docente', !m.periodo.trim() && 'el periodo'].filter(Boolean);
  const faltanExterna = [
    !mx.nombre.trim() && 'el nombre',
    mx.creditos === '' && 'los créditos',
    mx.horas === '' && 'las horas',
    mx.nota === '' && 'la nota',
    mx.anio === '' && 'el año',
    !silaboId && 'el sílabo en PDF',
  ].filter(Boolean);
  const vista = vistaNota(mx.nota, mx.escala);

  const agregar = async (e: FormEvent) => {
    e.preventDefault();
    if (faltanUta.length) return;
    try {
      await api(`/solicitudes/${s!.id}/materias`, { method: 'POST', body: JSON.stringify({ ...m, nivel }) });
      setM(vacia);
      setError('');
      recargar();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const agregarExterna = async (e: FormEvent) => {
    e.preventDefault();
    if (faltanExterna.length) return;
    try {
      await api(`/solicitudes/${s!.id}/materias-externas`, { method: 'POST', body: JSON.stringify({ ...mx, silaboId }) });
      setMx(vaciaExterna);
      setSilaboId(undefined);
      setClaveSilabo((k) => k + 1);
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

  // Mientras llega la solicitud no se muestra ningún formulario (antes aparecía un momento el de la UTA)
  if (!s) {
    return (
      <main>
        <p className="vacio">Cargando…</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Tus materias aprobadas</h1>
      <p className="ayuda">Registra una por una las materias que aprobaste. Cuando termines, envíalas a homologar.</p>
      <Pasos actual={2} />

      {s && (
        <div className="resumen-solicitud">
          <div>
            <small>{externo ? 'Vienes de' : 'Carrera de origen'}</small>
            <strong>{externo ? `${s.universidadOrigen} · ${s.carreraOrigen}` : nombreCarrera(s.carreraOrigen)}</strong>
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

      <LeerRecord
        key={s.id}
        solicitudId={s.id}
        externo={externo}
        recordId={s.recordId}
        carreraOrigen={s.carreraOrigen}
        nombreCarreraOrigen={externo ? (s.carreraOrigen ?? 'tu carrera') : nombreCarrera(s.carreraOrigen)}
        registradas={s.materias}
        alTerminar={recargar}
      />

      <h2>O agrega una materia a mano</h2>
      <p className="ayuda">
        Los campos con <span className="req">*</span> son obligatorios.{' '}
        {externo
          ? 'Copia los datos tal como aparecen en tu récord y en el sílabo.'
          : 'Elige primero el nivel para ver las materias de ese nivel.'}
      </p>
      {externo ? (
        <form className="doble" onSubmit={agregarExterna}>
          <label className="completo">
            <span>
              Nombre de la materia <span className="req">*</span>
            </span>
            <input value={mx.nombre} placeholder="Por ejemplo: Cálculo II" onChange={(e) => setMx({ ...mx, nombre: e.target.value })} />
            <small className="pista">
              Tal como aparece en tu récord. Si tu materia está dividida en partes (Física I y Física II), registra cada parte: el agente las evalúa juntas.
            </small>
          </label>
          <label>
            <span>
              Créditos <span className="req">*</span>
            </span>
            <input type="number" min={0} placeholder="Por ejemplo: 4" value={mx.creditos} onChange={(e) => setMx({ ...mx, creditos: num(e.target.value) })} />
          </label>
          <label>
            <span>
              Horas totales <span className="req">*</span>
            </span>
            <input type="number" min={0} placeholder="Por ejemplo: 160" value={mx.horas} onChange={(e) => setMx({ ...mx, horas: num(e.target.value) })} />
            <small className="pista">Están en el sílabo o en la malla.</small>
          </label>
          <label>
            <span>
              Nota <span className="req">*</span>
            </span>
            <input type="number" step="0.1" placeholder="Por ejemplo: 16" value={mx.nota} onChange={(e) => setMx({ ...mx, nota: num(e.target.value) })} />
            {vista && <small className={`pista ${vista.alerta ? 'alerta' : 'bien'}`}>{vista.texto}</small>}
          </label>
          <label>
            Tu universidad califica sobre
            <select value={mx.escala} onChange={(e) => setMx({ ...mx, escala: Number(e.target.value) })}>
              <option value={10}>10 puntos</option>
              <option value={20}>20 puntos</option>
              <option value={100}>100 puntos</option>
            </select>
            <small className="pista">El sistema convierte tu nota a la escala de la UTA (sobre 10).</small>
          </label>
          <label>
            <span>
              Año de aprobación <span className="req">*</span>
            </span>
            <input type="number" placeholder={`Por ejemplo: ${ANIO_ACTUAL - 1}`} value={mx.anio} onChange={(e) => setMx({ ...mx, anio: num(e.target.value) })} />
            {mx.anio !== '' && ANIO_ACTUAL - mx.anio > 10 && (
              <small className="pista alerta">Hace más de 10 años: no cumpliría la regla RN-05.</small>
            )}
          </label>
          <SubirPdf key={claveSilabo} etiqueta="Sílabo de la materia (PDF)" tipo="SILABO" alSubir={setSilaboId} obligatorio pista="Sin el sílabo el agente no puede comparar los temas." />
          {error && <p role="alert">{error}</p>}
          {faltanExterna.length > 0 && <p className="falta completo">Para agregarla falta: {faltanExterna.join(', ')}.</p>}
          <button type="submit" disabled={faltanExterna.length > 0}>
            Agregar materia
          </button>
        </form>
      ) : (
        <form className="doble" onSubmit={agregar}>
          <label>
            <span>
              Nivel <span className="req">*</span>
            </span>
            <select value={nivel} onChange={(e) => setNivel(e.target.value)}>
              <option value="">Elige el nivel</option>
              {niveles.map((n) => <option key={n}>{n}</option>)}
            </select>
          </label>
          <label>
            <span>
              Materia de {s ? nombreCarrera(s.carreraOrigen) : 'tu carrera'} <span className="req">*</span>
            </span>
            <select
              value={m.codigo}
              disabled={!nivel}
              onChange={(e) =>
                setM({ ...m, codigo: e.target.value, docente: asignaturas.find((a) => a.codigo === e.target.value)?.docente ?? '' })
              }
            >
              <option value="">{nivel ? 'Elige la materia' : 'Primero elige el nivel'}</option>
              {asignaturas.map((a) => <option key={a.codigo} value={a.codigo}>{a.nombre}</option>)}
            </select>
          </label>
          <label>
            Paralelo
            <input value={m.paralelo} onChange={(e) => setM({ ...m, paralelo: e.target.value })} />
          </label>
          <label>
            <span>
              Docente <span className="req">*</span>
            </span>
            <input value={m.docente} placeholder="Se llena solo al elegir la materia" onChange={(e) => setM({ ...m, docente: e.target.value })} />
          </label>
          <label>
            <span>
              Periodo <span className="req">*</span>
            </span>
            <input value={m.periodo} placeholder="Por ejemplo: ABRIL 2025 - AGOSTO 2025" onChange={(e) => setM({ ...m, periodo: e.target.value })} />
          </label>
          <label>
            Año de aprobación
            <input type="number" value={m.anio} onChange={(e) => setM({ ...m, anio: Number(e.target.value) })} />
            {ANIO_ACTUAL - m.anio > 10 && <small className="pista alerta">Hace más de 10 años: no cumpliría la regla RN-05.</small>}
          </label>
          <label>
            Nota (sobre 10)
            <input type="number" step="0.1" value={m.nota} onChange={(e) => setM({ ...m, nota: Number(e.target.value) })} />
            {m.nota < 7 && <small className="pista alerta">Menor a 7: no cumpliría la nota mínima (RN-04).</small>}
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
          {faltanUta.length > 0 && <p className="falta completo">Para agregarla falta: {faltanUta.join(', ')}.</p>}
          <button type="submit" disabled={faltanUta.length > 0}>
            Agregar materia
          </button>
        </form>
      )}

      <h2>Registradas {s.materias.length > 0 && <span className="contador">{s.materias.length}</span>}</h2>
      {!s?.materias.length && <p className="vacio">Aún no registras materias.</p>}
      <ul className="lista">
        {s?.materias.map((x) => (
          <li key={x.codigo}>
            <span>
              <strong>{x.nombre}</strong>
              <small>{externo ? `${x.creditos} créditos · ${x.horas} h` : `${x.nivel} · nota ${x.nota}`}</small>
            </span>
            {externo && x.notaOriginal != null && (
              <span className="notas">
                <span>
                  <small>Nota original</small>
                  <b>{numero(x.notaOriginal)} / {x.escala}</b>
                </span>
                <span className="flecha">→</span>
                <span>
                  <small>Nota UTA</small>
                  <b>{numero(x.nota, 1)} / 10</b>
                </span>
              </span>
            )}
            <button onClick={() => void quitar(x.codigo)}>Quitar</button>
          </li>
        ))}
      </ul>
      {s.materias.length > 0 && (
        <p className="guia corta">
          Revisa que estén todas tus materias: <b>después de enviar ya no podrás cambiarlas</b>. El agente tarda unos minutos.
        </p>
      )}
      <div className="acciones final">
        <button onClick={() => void enviar()} disabled={!s?.materias.length}>
          Enviar a homologar →
        </button>
      </div>
    </main>
  );
}