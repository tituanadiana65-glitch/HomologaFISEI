import { useLocation, useNavigate } from 'react-router-dom';
import { guardarSesion, sesion } from '../api';

export default function Barra() {
  const ir = useNavigate();
  const { pathname } = useLocation(); // vuelve a dibujar la barra al cambiar de página
  const s = sesion();

  if (pathname === '/') return null; // el login tiene su propio diseño

  const salir = () => {
    guardarSesion(null);
    ir('/');
  };

  return (
    <header className="barra">
      <div className="marca">
        <strong>HomologaFISEI</strong>
        <small>Universidad Técnica de Ambato · FISEI</small>
      </div>
      {s && (
        <div className="usuario">
          <span>{s.usuario.nombre}</span>
          <button className="secundario" onClick={salir}>Salir</button>
        </div>
      )}
    </header>
  );
}