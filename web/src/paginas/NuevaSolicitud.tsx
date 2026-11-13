import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Pasos from '../componentes/Pasos';
import SubirPdf from '../componentes/SubirPdf';

interface Carrera { codigo: string; nombre: string }
interface Solicitud { id: number; estado: string }

export default function NuevaSolicitud() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [externo, setExterno] = useState(false); // false: de la UTA · true: de otra universidad
  const [d, setD] = useState({ carreraOrigen: 'TI', carreraDestino: 'SW', periodo: 'NOVIEMBRE 2026 - MARZO 2027' });
  const [x, setX] = useState({ universidadOrigen: '', carreraOrigen: '', periodosAprobados: 1, documentosLegalizados: false });
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

  const crear = async (e: FormEvent) => {
    e.preventDefault();
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
              Universidad de origen
              <input value={x.universidadOrigen} placeholder="Universidad Central del Ecuador" onChange={(e) => setX({ ...x, universidadOrigen: e.target.value })} />
            </label>
            <label>
              Carrera de origen
              <input value={x.carreraOrigen} placeholder="Ingeniería en Computación" onChange={(e) => setX({ ...x, carreraOrigen: e.target.value })} />
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
        </label>

        {externo && (
          <>
            <label>
              Periodos aprobados
              <input type="number" min={0} value={x.periodosAprobados} onChange={(e) => setX({ ...x, periodosAprobados: Number(e.target.value) })} />
            </label>
            <SubirPdf etiqueta="Malla curricular (PDF)" tipo="MALLA" alSubir={setMallaId} />
            <SubirPdf etiqueta="Récord académico (PDF)" tipo="RECORD" alSubir={setRecordId} />
            <label className="casilla">
              <input type="checkbox" checked={x.documentosLegalizados} onChange={(e) => setX({ ...x, documentosLegalizados: e.target.checked })} />
              Mis documentos están legalizados
            </label>
          </>
        )}

        {error && <p role="alert">{error}</p>}
        <button type="submit">Crear solicitud</button>
      </form>
    </main>
  );
}