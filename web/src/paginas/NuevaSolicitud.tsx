import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Pasos from '../componentes/Pasos';
import SubirPdf from '../componentes/SubirPdf';

interface Carrera { codigo: string; nombre: string }
interface Solicitud { id: number; estado: string }

// Carreras afines más comunes en otras universidades. Si no está la suya, el estudiante elige "Otra carrera" y la escribe.
const CARRERAS_OTRA_UNIVERSIDAD = [
  'Ingeniería en Sistemas',
  'Ingeniería en Computación',
  'Ingeniería de Software',
  'Tecnologías de la Información',
  'Ciencias de la Computación',
  'Ingeniería Electrónica',
  'Ingeniería en Telecomunicaciones',
  'Ingeniería Eléctrica',
  'Ingeniería en Automatización y Control',
  'Ingeniería Mecatrónica',
  'Ingeniería Industrial',
];
const OTRA = '__otra';

// Sugerencias para la universidad de origen (se puede escribir cualquier otra)
const UNIVERSIDADES = [
  'Universidad Central del Ecuador',
  'Escuela Politécnica Nacional',
  'Escuela Superior Politécnica del Litoral',
  'Escuela Superior Politécnica de Chimborazo',
  'Universidad de las Fuerzas Armadas ESPE',
  'Pontificia Universidad Católica del Ecuador',
  'Universidad de Cuenca',
  'Universidad Técnica Particular de Loja',
  'Universidad Técnica de Cotopaxi',
  'Universidad Técnica del Norte',
  'Universidad Nacional de Chimborazo',
  'Universidad Politécnica Salesiana',
  'Universidad San Francisco de Quito',
  'Universidad de Guayaquil',
  'Universidad Técnica de Manabí',
  'Universidad Tecnológica Indoamérica',
];

export default function NuevaSolicitud() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [externo, setExterno] = useState(false); // false: de la UTA · true: de otra universidad
  const [d, setD] = useState({ carreraOrigen: 'TI', carreraDestino: 'SW', periodo: 'NOVIEMBRE 2026 - MARZO 2027' });
  const [x, setX] = useState({ universidadOrigen: '', carreraOrigen: '', periodosAprobados: 1, documentosLegalizados: false });
  const [otraCarrera, setOtraCarrera] = useState(false); // la carrera de otra universidad no está en la lista
  const [mallaId, setMallaId] = useState<number>();
  const [recordId, setRecordId] = useState<number>();
  const [error, setError] = useState('');
  const ir = useNavigate();

  useEffect(() => {
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras);
    void api<Solicitud | Blob | null>('/solicitudes/mia').then((s) => {
      if (!s || s instanceof Blob) return; // no tiene solicitud: se muestra el formulario
      if (s.estado === 'BORRADOR') ir('/materias');
      else if (s.estado !== 'RESULTADO_LISTO') ir('/resultado');
    });
  }, [ir]);

  // Lo que falta para poder crear la solicitud (el botón se activa cuando no falta nada)
  const faltan = externo
    ? [
        !x.universidadOrigen.trim() && 'la universidad de origen',
        !x.carreraOrigen.trim() && 'la carrera de origen',
        !mallaId && 'la malla curricular',
        !recordId && 'el récord académico',
      ].filter(Boolean)
    : [d.carreraOrigen === d.carreraDestino && 'una carrera de destino distinta a la de origen'].filter(Boolean);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (faltan.length) return;
    const cuerpo = externo
      ? { tipo: 'EXTERNO', ...x, carreraDestino: d.carreraDestino, periodo: d.periodo, mallaId, recordId }
      : { tipo: 'INTERNO', ...d };
    try {
      await api('/solicitudes', { method: 'POST', body: JSON.stringify(cuerpo) });
      ir('/materias');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const opciones = carreras.map((c) => (
    <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
  ));

  return (
    <main>
      <h1>Nueva solicitud de cambio de carrera</h1>
      <p className="ayuda">Indica de dónde vienes, a qué carrera te cambias y el periodo en que harás el trámite.</p>
      <Pasos actual={1} />

      <div className="guia">
        <strong>Antes de empezar</strong>
        {externo ? (
          <ul>
            <li>
              Ten listos en <b>PDF con texto</b> (que se pueda seleccionar, no escaneado): tu <b>malla curricular</b>, tu <b>récord académico</b> y el{' '}
              <b>sílabo</b> de cada materia que quieras homologar.
            </li>
            <li>
              Para cambiarte desde otra universidad necesitas al menos <b>2 periodos aprobados</b> y tus documentos <b>legalizados</b> (regla RN-08).
            </li>
            <li>Son 3 pasos: crear la solicitud, registrar tus materias y ver el resultado.</li>
          </ul>
        ) : (
          <ul>
            <li>Ten a mano tus materias aprobadas con su nota, paralelo, docente y periodo.</li>
            <li>Son 3 pasos: crear la solicitud, registrar tus materias y ver el resultado.</li>
          </ul>
        )}
      </div>

      <div className="opciones-tipo">
        <label className={!externo ? 'activa' : ''}>
          <input type="radio" checked={!externo} onChange={() => setExterno(false)} />
          <span>
            Soy estudiante de la UTA
            <small>Me cambio de una carrera de la FISEI a otra</small>
          </span>
        </label>
        <label className={externo ? 'activa' : ''}>
          <input type="radio" checked={externo} onChange={() => setExterno(true)} />
          <span>
            Vengo de otra universidad
            <small>Necesito subir mi malla, mi récord y los sílabos</small>
          </span>
        </label>
      </div>

      <form className="doble" onSubmit={crear}>
        {externo ? (
          <>
            <label>
              <span>
                Universidad de origen <span className="req">*</span>
              </span>
              <input
                value={x.universidadOrigen}
                list="universidades"
                placeholder="Escribe o elige tu universidad"
                onChange={(e) => setX({ ...x, universidadOrigen: e.target.value })}
              />
              <datalist id="universidades">
                {UNIVERSIDADES.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </label>
            <label>
              <span>
                Carrera de origen <span className="req">*</span>
              </span>
              <select
                value={otraCarrera ? OTRA : x.carreraOrigen}
                onChange={(e) => {
                  const otra = e.target.value === OTRA;
                  setOtraCarrera(otra);
                  setX({ ...x, carreraOrigen: otra ? '' : e.target.value });
                }}
              >
                <option value="">Elige tu carrera…</option>
                {CARRERAS_OTRA_UNIVERSIDAD.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={OTRA}>Otra carrera (escribirla)</option>
              </select>
              {otraCarrera && (
                <input value={x.carreraOrigen} placeholder="Escribe el nombre de tu carrera" autoFocus onChange={(e) => setX({ ...x, carreraOrigen: e.target.value })} />
              )}
            </label>
          </>
        ) : (
          <label>
            Carrera de origen
            <select value={d.carreraOrigen} onChange={(e) => setD({ ...d, carreraOrigen: e.target.value })}>{opciones}</select>
          </label>
        )}
        <label>
          Carrera de destino
          <select value={d.carreraDestino} onChange={(e) => setD({ ...d, carreraDestino: e.target.value })}>{opciones}</select>
        </label>
        <label>
          Periodo del trámite
          <input value={d.periodo} onChange={(e) => setD({ ...d, periodo: e.target.value })} />
          <small className="pista">El periodo académico en que presentarás el trámite.</small>
        </label>

        {externo && (
          <>
            <label>
              Periodos aprobados
              <input type="number" min={0} value={x.periodosAprobados} onChange={(e) => setX({ ...x, periodosAprobados: Number(e.target.value) })} />
              {x.periodosAprobados < 2 ? (
                <small className="pista alerta">Con menos de 2 periodos no cumples RN-08, pero igual puedes ver qué materias se homologarían.</small>
              ) : (
                <small className="pista">Semestres completos que aprobaste en tu universidad.</small>
              )}
            </label>
            <SubirPdf etiqueta="Malla curricular (PDF)" tipo="MALLA" alSubir={setMallaId} obligatorio pista="La lista de materias de tu carrera." />
            <SubirPdf etiqueta="Récord académico (PDF)" tipo="RECORD" alSubir={setRecordId} obligatorio pista="El documento con tus notas." />
            <label className="casilla">
              <input type="checkbox" checked={x.documentosLegalizados} onChange={(e) => setX({ ...x, documentosLegalizados: e.target.checked })} />
              <span>
                Mis documentos están legalizados
                <small className="pista">Márcalo solo si tu malla y tu récord tienen el sello de legalización.</small>
              </span>
            </label>
          </>
        )}

        {error && <p role="alert">{error}</p>}
        {faltan.length > 0 && <p className="falta completo">Para continuar falta: {faltan.join(', ')}.</p>}
        <button type="submit" disabled={faltan.length > 0}>
          Crear solicitud y seguir →
        </button>
      </form>
    </main>
  );
}