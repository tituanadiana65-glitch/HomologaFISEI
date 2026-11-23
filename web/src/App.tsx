import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { sesion } from './api';
import Login from './paginas/Login';
import Administracion from './paginas/Administracion';
import Revision from './paginas/Revision';
import Coordinacion from './paginas/Coordinacion';
import CoordinacionDetalle from './paginas/CoordinacionDetalle';
import NuevaSolicitud from './paginas/NuevaSolicitud';
import Homologacion from './paginas/Homologacion';
import Barra from './componentes/Barra';

const SoloAdmin = ({ children }: { children: ReactNode }) => (sesion()?.usuario.rol === 'ADMIN' ? children : <Navigate to="/" />);
// Coordinador (asigna docentes) y docente (hace la homologación)
const SoloCoordinador = ({ children }: { children: ReactNode }) => (sesion()?.usuario.rol === 'COORDINADOR' ? children : <Navigate to="/" />);
const SoloDocente = ({ children }: { children: ReactNode }) => (sesion()?.usuario.rol === 'DOCENTE' ? children : <Navigate to="/" />);

export default function App() {
  return (
    <BrowserRouter>
      <Barra />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/admin" element={<SoloAdmin><Administracion /></SoloAdmin>} />
        <Route path="/coordinacion" element={<SoloCoordinador><Coordinacion /></SoloCoordinador>} />
        <Route path="/coordinacion/nueva" element={<SoloCoordinador><NuevaSolicitud /></SoloCoordinador>} />
        <Route path="/coordinacion/:id" element={<SoloCoordinador><CoordinacionDetalle /></SoloCoordinador>} />
        <Route path="/revision" element={<SoloDocente><Revision /></SoloDocente>} />
        <Route path="/homologacion/:id" element={<SoloDocente><Homologacion /></SoloDocente>} />
      </Routes>
    </BrowserRouter>
    
  );
}