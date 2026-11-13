import { useState } from 'react';
import { api } from '../api';

interface Subido { id: number; nombre: string; caracteres: number }
type Tipo = 'MALLA' | 'RECORD' | 'SILABO';

// Sube un PDF a ms-documentos (T39) apenas se elige y avisa su id al formulario
export default function SubirPdf({ etiqueta, tipo, alSubir }: { etiqueta: string; tipo: Tipo; alSubir: (id: number | undefined) => void }) {
  const [estado, setEstado] = useState<'' | 'subiendo' | 'ok' | 'error'>('');
  const [mensaje, setMensaje] = useState('');

  const subir = async (archivo: File | undefined) => {
    alSubir(undefined);
    if (!archivo) {
      setEstado('');
      setMensaje('');
      return;
    }
    setEstado('subiendo');
    setMensaje('Leyendo el PDF…');
    const datos = new FormData();
    datos.append('tipo', tipo);
    datos.append('archivo', archivo);
    try {
      const r = await api<Subido>('/documentos/archivos', { method: 'POST', body: datos });
      alSubir(r.id);
      setEstado('ok');
      setMensaje(`✓ ${r.nombre} · ${r.caracteres.toLocaleString('es-EC')} caracteres leídos`);
    } catch (err) {
      setEstado('error');
      setMensaje((err as Error).message);
    }
  };

  return (
    <label>
      {etiqueta}
      <input type="file" accept="application/pdf" onChange={(e) => void subir(e.target.files?.[0])} />
      {mensaje && <small className={`subida ${estado}`}>{mensaje}</small>}
    </label>
  );
}