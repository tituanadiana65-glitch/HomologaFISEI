import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import Materias from './Materias';
import Resultado from './Resultado';
import RevisionDetalle from './RevisionDetalle';

// Página de trabajo del docente para una solicitud: según la etapa muestra el expediente y las materias,
// la espera del agente o la revisión del análisis
export default function Homologacion() {
  const { id } = useParams();
  const n = Number(id);
  const [estado, setEstado] = useState<string | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(() => {
    void api<{ estado: string }>(`/solicitudes/${n}`)
      .then((s) => setEstado(s.estado))
      .catch((e: Error) => setError(e.message));
  }, [n]);
  useEffect(cargar, [cargar]);

  if (error) return <main><p role="alert">{error}</p></main>;
  if (!estado) return <main><p className="vacio">Cargando…</p></main>;
  if (estado === 'BORRADOR') return <Materias id={n} alEnviar={cargar} />;
  if (estado === 'ENVIADA') return <Resultado id={n} alListo={cargar} />;
  return <RevisionDetalle />;
}
