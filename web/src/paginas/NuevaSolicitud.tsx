import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { cedulaValida, limpiarDocumento } from '../documento';
import { api } from '../api';

interface Carrera { codigo: string; nombre: string }

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

interface Docente { id: number; nombre: string }

// El coordinador registra la solicitud que el estudiante entregó en papel y elige el docente que hará la homologación
export default function NuevaSolicitud() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [externo, setExterno] = useState(false); // false: de la UTA · true: de otra universidad
  const [d, setD] = useState({ carreraOrigen: 'TI', carreraDestino: 'SW', periodo: 'NOVIEMBRE 2026 - MARZO 2027' });
  const [x, setX] = useState({ universidadOrigen: '', carreraOrigen: '', periodosAprobados: 1, documentosLegalizados: false });
  const [otraCarrera, setOtraCarrera] = useState(false); // la carrera de otra universidad no está en la lista
  const [estudiante, setEstudiante] = useState('');
  const [tipoDocumento, setTipoDocumento] = useState<'CEDULA' | 'PASAPORTE'>('CEDULA');
  const [documento, setDocumento] = useState('');
  const doc = limpiarDocumento(documento);
  const docValido = tipoDocumento === 'CEDULA' ? cedulaValida(doc) : /^[A-Z0-9]{5,20}$/.test(doc);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [docenteId, setDocenteId] = useState('');
  const [error, setError] = useState('');
  const ir = useNavigate();

  useEffect(() => {
    void api<Carrera[]>('/catalogo/carreras').then(setCarreras);
    void api<Docente[]>('/identidad/docentes').then(setDocentes).catch(() => setDocentes([]));
  }, []);

  // Lo que falta para poder crear la solicitud (el botón se activa cuando no falta nada)
  const faltan = [
    estudiante.trim().length < 3 && 'el nombre del estudiante',
    !doc ? (tipoDocumento === 'CEDULA' ? 'la cédula' : 'el pasaporte') : !docValido && (tipoDocumento === 'CEDULA' ? 'una cédula válida' : 'un pasaporte válido'),
    ...(externo
      ? [!x.universidadOrigen.trim() && 'la universidad de origen', !x.carreraOrigen.trim() && 'la carrera de origen']
      : [d.carreraOrigen === d.carreraDestino && 'una carrera de destino distinta a la de origen']),
  ].filter(Boolean);

  const crear = async (e: FormEvent) => {
    e.preventDefault();
    if (faltan.length) return;
    const docente = docentes.find((x) => String(x.id) === docenteId);
    const cuerpo = {
      estudiante,
      documento: doc,
      tipoDocumento,
      ...(externo ? { tipo: 'EXTERNO', ...x, carreraDestino: d.carreraDestino, periodo: d.periodo } : { tipo: 'INTERNO', ...d }),
      ...(docente ? { docenteId: docente.id, docente: docente.nombre } : {}),
    };
    try {
      await api('/solicitudes/coordinacion', { method: 'POST', body: JSON.stringify(cuerpo) });
      ir('/coordinacion');
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const opciones = carreras.map((c) => (
    <option key={c.codigo} value={c.codigo}>{c.nombre}</option>
  ));

  return (
    <main>
      <p>
        <Link className="volver" to="/coordinacion">
          ← Volver a coordinación
        </Link>
      </p>
      <h1>Registrar una solicitud</h1>
      <p className="ayuda">Registra la solicitud que entregó el estudiante y elige el docente que hará la homologación.</p>

      <div className="guia">
        <strong>Cómo sigue</strong>
        <ul>
          <li>El docente que elijas sube el expediente del estudiante (récord{externo ? ', malla y sílabos' : ''}) y registra sus materias.</li>
          <li>El agente hace el análisis y el docente lo revisa.</li>
          <li>El docente te envía lo homologable y lo no homologable.</li>
        </ul>
      </div>

      <div className="opciones-tipo">
        <label className={!externo ? 'activa' : ''}>
          <input type="radio" checked={!externo} onChange={() => setExterno(false)} />
          <span>
            Estudiante de la UTA
            <small>Se cambia de una carrera de la FISEI a otra</small>
          </span>
        </label>
        <label className={externo ? 'activa' : ''}>
          <input type="radio" checked={externo} onChange={() => setExterno(true)} />
          <span>
            Viene de otra universidad
            <small>Su expediente trae malla, récord y sílabos</small>
          </span>
        </label>
      </div>

      <form className="doble" onSubmit={crear}>
        <label className="completo">
          <span>
            Nombre del estudiante <span className="req">*</span>
          </span>
          <input value={estudiante} placeholder="Nombres y apellidos" onChange={(e) => setEstudiante(e.target.value)} />
        </label>
        <label>
          <span>
            Documento <span className="req">*</span>
          </span>
          <select value={tipoDocumento} onChange={(e) => setTipoDocumento(e.target.value as 'CEDULA' | 'PASAPORTE')}>
            <option value="CEDULA">Cédula</option>
            <option value="PASAPORTE">Pasaporte (estudiante extranjero)</option>
          </select>
        </label>
        <label>
          <span>
            {tipoDocumento === 'CEDULA' ? 'Número de cédula' : 'Número de pasaporte'} <span className="req">*</span>
          </span>
          <input
            value={documento}
            inputMode={tipoDocumento === 'CEDULA' ? 'numeric' : 'text'}
            maxLength={tipoDocumento === 'CEDULA' ? 11 : 20}
            placeholder={tipoDocumento === 'CEDULA' ? '1801234566' : 'AB123456'}
            onChange={(e) => setDocumento(e.target.value)}
          />
          {doc && !docValido && (
            <small className="pista alerta">
              {tipoDocumento === 'CEDULA' ? 'Revisa la cédula: no es válida (10 dígitos con su dígito verificador).' : 'De 5 a 20 letras o números.'}
            </small>
          )}
          {!doc && <small className="pista">Así no se confunde con otro estudiante del mismo nombre.</small>}
        </label>
        {externo ? (
          <>
            <label>
              <span>
                Universidad de origen <span className="req">*</span>
              </span>
              <input
                value={x.universidadOrigen}
                list="universidades"
                placeholder="Escribe o elige la universidad"
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
                <option value="">Elige la carrera…</option>
                {CARRERAS_OTRA_UNIVERSIDAD.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value={OTRA}>Otra carrera (escribirla)</option>
              </select>
              {otraCarrera && (
                <input value={x.carreraOrigen} placeholder="Escribe el nombre de la carrera" autoFocus onChange={(e) => setX({ ...x, carreraOrigen: e.target.value })} />
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
          <small className="pista">El periodo académico del trámite.</small>
        </label>

        {externo && (
          <>
            <label>
              Periodos aprobados
              <input type="number" min={0} value={x.periodosAprobados} onChange={(e) => setX({ ...x, periodosAprobados: Number(e.target.value) })} />
              {x.periodosAprobados < 2 ? (
                <small className="pista alerta">Con menos de 2 periodos no cumple RN-08, pero igual se puede ver qué materias se homologarían.</small>
              ) : (
                <small className="pista">Semestres completos que aprobó en su universidad.</small>
              )}
            </label>
            <label className="casilla">
              <input type="checkbox" checked={x.documentosLegalizados} onChange={(e) => setX({ ...x, documentosLegalizados: e.target.checked })} />
              <span>
                Los documentos están legalizados
                <small className="pista">Márcalo solo si la malla y el récord tienen el sello de legalización (el docente lo puede corregir).</small>
              </span>
            </label>
          </>
        )}

        <label className="completo">
          Docente que hará la homologación
          <select value={docenteId} onChange={(e) => setDocenteId(e.target.value)}>
            <option value="">Lo elijo después</option>
            {docentes.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nombre}
              </option>
            ))}
          </select>
        </label>

        {error && <p role="alert">{error}</p>}
        {faltan.length > 0 && <p className="falta completo">Para continuar falta: {faltan.join(', ')}.</p>}
        <button type="submit" disabled={faltan.length > 0}>
          Registrar solicitud
        </button>
      </form>
    </main>
  );
}