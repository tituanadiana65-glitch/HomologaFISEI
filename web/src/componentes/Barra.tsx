import { useLocation, useNavigate } from 'react-router-dom';
import { guardarSesion, sesion } from '../api';

// «Diana Tituaña» → «DT»
const iniciales = (nombre: string) =>
  nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');

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
        <span className="logo">H</span>
        <div>
          <strong>HomologaFISEI</strong>
          <small>Universidad Técnica de Ambato · FISEI</small>
        </div>
      </div>
      {s && (
        <div className="usuario">
          <span className="avatar">{iniciales(s.usuario.nombre)}</span>
          <span className="nombre">{s.usuario.nombre}</span>
          <button className="secundario" onClick={salir}>Salir</button>
        </div>
      )}
    </header>
  );
}