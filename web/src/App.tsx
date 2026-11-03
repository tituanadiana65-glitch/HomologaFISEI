import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { sesion } from './api';
import Login from './paginas/Login';
import NuevaSolicitud from './paginas/NuevaSolicitud'; 
import Materias from './paginas/Materias';
import Resultado from './paginas/Resultado';
  import Administracion from './paginas/Administracion';

const Privada = ({ children }: { children: ReactNode }) => (sesion() ? children : <Navigate to="/" />);
const SoloAdmin = ({ children }: { children: ReactNode }) => (sesion()?.usuario.rol === 'ADMIN' ? children : <Navigate to="/" />);

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/solicitud" element={<Privada><NuevaSolicitud /></Privada>} />
        <Route path="/materias" element={<Privada><Materias /></Privada>} />
        <Route path="/resultado" element={<Privada><Resultado /></Privada>} />
        <Route path="/admin" element={<SoloAdmin><Administracion /></SoloAdmin>} />
      </Routes>
    </BrowserRouter>
  );
}