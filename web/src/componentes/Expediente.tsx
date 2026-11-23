import { useState } from 'react';
import { api } from '../api';
import SubirPdf from './SubirPdf';

// El docente sube el expediente que el estudiante entregó: récord (y, de otra universidad, malla, periodos y legalización)
interface Datos {
  id: number;
  tipo?: string;
  mallaId?: number | null;
  recordId?: number | null;
  periodosAprobados?: number | null;
  documentosLegalizados?: boolean | null;
}

export default function Expediente({ s, alCambiar }: { s: Datos; alCambiar: () => void }) {
  const externo = s.tipo === 'EXTERNO';
  const [error, setError] = useState('');

  const guardar = async (cambio: object) => {
    try {
      await api(`/solicitudes/${s.id}/expediente`, { method: 'PUT', body: JSON.stringify(cambio) });
      setError('');
      alCambiar();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <section className="leer-record">
      <h2>Expediente del estudiante</h2>
      <p className="ayuda">
        Sube en PDF (con texto, no escaneado) los documentos que entregó el estudiante.
        {externo && ' Para cambiarse desde otra universidad necesita al menos 2 periodos aprobados y documentos legalizados (RN-08).'}
      </p>
      <div className="doble">
        <div>
          <SubirPdf
            etiqueta="Récord académico (PDF)"
            tipo="RECORD"
            obligatorio={externo}
            alSubir={(id) => id && void guardar({ recordId: id })}
            pista={s.recordId ? '✓ Ya está en el expediente. Sube otro solo si quieres cambiarlo.' : 'Las notas del estudiante: con él se llenan las materias.'}
          />
        </div>
        {externo && (
          <div>
            <SubirPdf
              etiqueta="Malla curricular (PDF)"
              tipo="MALLA"
              obligatorio
              alSubir={(id) => id && void guardar({ mallaId: id })}
              pista={s.mallaId ? '✓ Ya está en el expediente. Sube otra solo si quieres cambiarla.' : 'La lista de materias de su carrera.'}
            />
          </div>
        )}
        {externo && (
          <label>
            Periodos aprobados
            <input
              type="number"
              min={1}
              max={12}
              defaultValue={s.periodosAprobados ?? 1}
              onBlur={(e) => Number(e.target.value) !== s.periodosAprobados && void guardar({ periodosAprobados: Number(e.target.value) })}
            />
            <small className="pista">Semestres completos que aprobó en su universidad.</small>
          </label>
        )}
        {externo && (
          <label className="casilla">
            <input type="checkbox" checked={!!s.documentosLegalizados} onChange={(e) => void guardar({ documentosLegalizados: e.target.checked })} />
            <span>
              Los documentos están legalizados
              <small className="pista">Márcalo solo si la malla y el récord tienen el sello de legalización.</small>
            </span>
          </label>
        )}
      </div>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
