import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';

interface Carrera {
  codigo: string;
  nombre: string;
  _count?: { asignaturas: number };
}

interface Regla {
  codigo: string;
  descripcion: string;
  valor: number;
  activa: boolean;
  version: number;
}

// RN-01 a RN-03 se guardan como 0.8 pero se muestran como 80 %
const esPorcentaje = (codigo: string) => ['RN-01', 'RN-02', 'RN-03'].includes(codigo);
const unidad = (codigo: string) => (esPorcentaje(codigo) ? '%' : codigo === 'RN-04' ? 'sobre 10' : codigo === 'RN-05' ? 'años' : '');
const aPantalla = (r: Regla) => String(esPorcentaje(r.codigo) ? Math.round(r.valor * 100) : r.valor);
const aGuardar = (codigo: string, texto: string) => (esPorcentaje(codigo) ? Number(texto) / 100 : Number(texto));

export default function Administracion() {
  const [carreras, setCarreras] = useState<Carrera[]>([]);
  const [reglas, setReglas] = useState<Regla[]>([]);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [archivos, setArchivos] = useState<FileList | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargarCarreras = () =>
    api<Carrera[]>('/catalogo/carreras')
      .then(setCarreras)
      .catch((e: Error) => setError(e.message));

  useEffect(() => {
    void cargarCarreras();
    void api<Regla[]>('/reglas/reglas')
      .then((r) => {
        setReglas(r);
        setValores(Object.fromEntries(r.map((x) => [x.codigo, aPantalla(x)])));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  const avisar = (texto: string, esError = false) => {
    setMensaje(esError ? '' : texto);
    setError(esError ? texto : '');
  };

  // Sube uno o varios planes analíticos en PDF; la carrera sale del código del plan
  const importar = async (e: FormEvent) => {
    e.preventDefault();
    if (!archivos?.length) return avisar('Elige al menos un plan analítico en PDF', true);
    setSubiendo(true);
    const guardados: string[] = [];
    const fallidos: string[] = [];
    for (const archivo of Array.from(archivos)) {
      const form = new FormData();
      form.append('archivo', archivo);
      try {
        const r = await api<{ nombre: string }>('/catalogo/planes/importar', { method: 'POST', body: form });
        guardados.push(r.nombre);
      } catch (err) {
        fallidos.push((err as Error).message);
      }
    }
    setSubiendo(false);
    setArchivos(null);
    (e.target as HTMLFormElement).reset();
    await cargarCarreras();
    if (fallidos.length) avisar(`No se pudo importar: ${fallidos.join(' · ')}`, true);
    else avisar(`Se importaron ${guardados.length} plan(es): ${guardados.join(', ')}`);
  };

  const guardar = async (r: Regla, cambios: { valor?: number; activa?: boolean }) => {
    try {
      const nueva = await api<Regla>(`/reglas/reglas/${r.codigo}`, { method: 'PUT', body: JSON.stringify(cambios) });
      setReglas((rs) => rs.map((x) => (x.codigo === nueva.codigo ? nueva : x)));
      setValores((v) => ({ ...v, [nueva.codigo]: aPantalla(nueva) }));
      avisar(`Se guardó ${nueva.codigo}. La próxima homologación ya usa este valor.`);
    } catch (err) {
      avisar((err as Error).message, true);
    }
  };

  return (
    <main className="admin">
      <h1>Administración</h1>
      <p className="ayuda">Aquí se agregan carreras con sus planes analíticos y se cambian las reglas de homologación.</p>

      {mensaje && <p className="aviso listo" role="status">✓ {mensaje}</p>}
      {error && <p role="alert">{error}</p>}

      <div className="admin-columnas">
        <section className="admin-tarjeta">
          <h2>Carreras y planes analíticos</h2>
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Carrera</th>
                <th>Materias</th>
              </tr>
            </thead>
            <tbody>
              {carreras.map((c) => (
                <tr key={c.codigo}>
                  <td>{c.codigo}</td>
                  <td>{c.nombre}</td>
                  <td>{c._count?.asignaturas ?? '—'}</td>
                </tr>
              ))}
              {carreras.length === 0 && (
                <tr>
                  <td colSpan={3} className="vacio">Todavía no hay carreras</td>
                </tr>
              )}
            </tbody>
          </table>

          <form onSubmit={importar}>
            <label>
              Plan analítico (PDF)
              <input type="file" accept="application/pdf" multiple onChange={(e) => setArchivos(e.target.files)} />
            </label>
            <small className="nota">Si el plan es de una carrera nueva, la carrera se crea sola.</small>
            <button type="submit" disabled={subiendo}>
              {subiendo ? 'Importando…' : 'Importar plan'}
            </button>
          </form>
        </section>

        <section className="admin-tarjeta">
          <h2>Reglas de homologación</h2>
          <small className="nota">Se aplican a todas las carreras.</small>
          <table>
            <thead>
              <tr>
                <th>Regla</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reglas.map((r) => (
                <tr key={r.codigo} className={r.activa ? '' : 'apagada'}>
                  <td>
                    <strong>{r.codigo}</strong>
                    <small className="equivale">{r.descripcion}</small>
                    {!r.activa && <small className="equivale">Desactivada</small>}
                  </td>
                  <td>
                    <span className="valor-regla">
                      <input
                        type="number"
                        step="1"
                        value={valores[r.codigo] ?? ''}
                        onChange={(e) => setValores({ ...valores, [r.codigo]: e.target.value })}
                      />
                      {unidad(r.codigo)}
                    </span>
                  </td>
                  <td className="botones-regla">
                    <button className="pequeno" onClick={() => void guardar(r, { valor: aGuardar(r.codigo, valores[r.codigo]) })}>
                      Guardar
                    </button>
                    <button className="enlace" onClick={() => void guardar(r, { activa: !r.activa })}>
                      {r.activa ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <p className="aviso">🔒 Solo el administrador puede entrar a esta pantalla.</p>
    </main>
  );
}
