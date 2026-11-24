import { Link, useParams } from 'react-router-dom';
import Resultado from './Resultado';

// El coordinador ve el resultado que le envió el docente (o el avance del análisis)
export default function CoordinacionDetalle() {
  const { id } = useParams();
  return (
    <>
      <p className="volver-arriba">
        <Link className="volver" to="/coordinacion">
          ← Volver a coordinación
        </Link>
      </p>
      <Resultado id={Number(id)} soloLectura />
    </>
  );
}
