import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { sesion } from './api';
import Login from './paginas/Login';
import NuevaSolicitud from './paginas/NuevaSolicitud'; 
import Materias from './paginas/Materias';
import Resultado from './paginas/Resultado';
import Administracion from './paginas/Administracion';
import Revision from './paginas/Revision';
import RevisionDetalle from './paginas/RevisionDetalle';
import Coordinacion from './paginas/Coordinacion';
import Barra from './componentes/Barra';

const Privada = ({ children }: { children: ReactNode }) => (sesion() ? children : <Navigate to="/" />);
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
        <Route path="/solicitud" element={<Privada><NuevaSolicitud /></Privada>} />
        <Route path="/materias" element={<Privada><Materias /></Privada>} />
        <Route path="/resultado" element={<Privada><Resultado /></Privada>} />
        <Route path="/admin" element={<SoloAdmin><Administracion /></SoloAdmin>} />
        <Route path="/coordinacion" element={<SoloCoordinador><Coordinacion /></SoloCoordinador>} />
        <Route path="/revision" element={<SoloDocente><Revision /></SoloDocente>} />
        <Route path="/revision/:id" element={<SoloDocente><RevisionDetalle /></SoloDocente>} />
      </Routes>
    </BrowserRouter>
    
  );
}