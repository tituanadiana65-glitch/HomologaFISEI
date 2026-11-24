import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import AdminPersonal from '../componentes/AdminPersonal';
import MatrizCarrera from '../componentes/MatrizCarrera';

interface Carrera {
  codigo: string;
  nombre: string;
  _count?: { asignaturas: number };
}

interface ResultadoRuta {
  total: number;
  importados: number;
  resultados: { archivo: string; ok: boolean; nombre?: string; conIA?: boolean; error?: string }[];
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
  const [nuevoCodigo, setNuevoCodigo] = useState('');
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [subiendo, setSubiendo] = useState(false);
  const [modo, setModo] = useState<'archivo' | 'ruta'>('archivo');
  const [ruta, setRuta] = useState('');
  const [carreraPlan, setCarreraPlan] = useState('');
  const [informeRuta, setInformeRuta] = useState<ResultadoRuta | null>(null);
  const [matriz, setMatriz] = useState<Carrera | null>(null);
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

  // T51 · Crea una carrera a mano (código y nombre)
  const crearCarrera = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const c = await api<Carrera>('/catalogo/carreras', {
        method: 'POST',
        body: JSON.stringify({ codigo: nuevoCodigo, nombre: nuevoNombre }),
      });
      setNuevoCodigo('');
      setNuevoNombre('');
      await cargarCarreras();
      avisar(`Se creó la carrera ${c.codigo} · ${c.nombre}`);
    } catch (err) {
      avisar((err as Error).message, true);
    }
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
        const consulta = carreraPlan ? `?carrera=${encodeURIComponent(carreraPlan)}` : '';
        const r = await api<{ nombre: string }>(`/catalogo/planes/importar${consulta}`, { method: 'POST', body: form });
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

  // Observación del 24/11/2026: traer todos los planes desde una URL o carpeta en vez de subirlos uno por uno
  const importarRuta = async (e: FormEvent) => {
    e.preventDefault();
    if (!ruta.trim()) return avisar('Escribe la URL o la ruta donde están los planes analíticos', true);
    setSubiendo(true);
    setInformeRuta(null);
    try {
      const r = await api<ResultadoRuta>('/catalogo/planes/importar-ruta', {
        method: 'POST',
        body: JSON.stringify({ ruta: ruta.trim(), carrera: carreraPlan || undefined }),
      });
      setInformeRuta(r);
      await cargarCarreras();
      const fallidos = r.total - r.importados;
      if (r.importados === 0) avisar(`No se pudo importar ninguno de los ${r.total} PDF. Mira el detalle abajo.`, true);
      else avisar(`Se importaron ${r.importados} de ${r.total} planes${fallidos ? `; ${fallidos} no se pudieron leer (detalle abajo)` : ''}.`);
    } catch (err) {
      avisar((err as Error).message, true);
    } finally {
      setSubiendo(false);
    }
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
      <p className="ayuda">Aquí se agregan carreras con sus planes analíticos, se cambian las reglas de homologación y se crean las cuentas del coordinador y los docentes.</p>

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
                  <td>
                    {c._count?.asignaturas ?? '—'}
                    {(c._count?.asignaturas ?? 0) > 0 && (
                      <button className="enlace ver-matriz" onClick={() => setMatriz(c)}>
                        Ver matriz
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {carreras.length === 0 && (
                <tr>
                  <td colSpan={3} className="vacio">Todavía no hay carreras</td>
                </tr>
              )}
            </tbody>
          </table>

          <form onSubmit={crearCarrera}>
            <h3>Nueva carrera</h3>
            <label>
              Código (2 a 10 letras)
              <input value={nuevoCodigo} maxLength={10} placeholder="RO" onChange={(e) => setNuevoCodigo(e.target.value.toUpperCase())} />
            </label>
            <label>
              Nombre
              <input value={nuevoNombre} placeholder="Robótica" onChange={(e) => setNuevoNombre(e.target.value)} />
            </label>
            <button type="submit">Crear carrera</button>
          </form>

          <h3>Importar planes analíticos</h3>
          <div className="pestanas" role="tablist">
            <button type="button" role="tab" className={modo === 'archivo' ? 'activa' : ''} onClick={() => setModo('archivo')}>
              Subir archivos
            </button>
            <button type="button" role="tab" className={modo === 'ruta' ? 'activa' : ''} onClick={() => setModo('ruta')}>
              Desde URL o carpeta
            </button>
          </div>

          <label>
            Carrera (opcional)
            <select value={carreraPlan} onChange={(e) => setCarreraPlan(e.target.value)}>
              <option value="">La saca el sistema del código del plan</option>
              {carreras.map((c) => (
                <option key={c.codigo} value={c.codigo}>
                  {c.codigo} · {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <small className="nota">Elígela si los planes no tienen el formato de la FISEI: así la inteligencia artificial los lee y arma la matriz.</small>

          {modo === 'archivo' ? (
            <form onSubmit={importar}>
              <label>
                Plan analítico (PDF)
                <input type="file" accept="application/pdf" multiple onChange={(e) => setArchivos(e.target.files)} />
              </label>
              <small className="nota">Puedes elegir varios a la vez. Si el plan es de una carrera nueva, la carrera se crea sola.</small>
              <button type="submit" disabled={subiendo}>
                {subiendo ? 'Importando…' : 'Importar plan'}
              </button>
            </form>
          ) : (
            <form onSubmit={importarRuta}>
              <label>
                URL o ruta de los planes
                <input value={ruta} placeholder="planes/SW  o  https://github.com/…/tree/main/planes/SW" onChange={(e) => setRuta(e.target.value)} />
              </label>
              <small className="nota">
                Sirve una carpeta de GitHub, una página con enlaces a los PDF, un PDF suelto o una carpeta dentro de «planes» del proyecto (por ejemplo{' '}
                <code>planes/SW</code>). Se importan hasta 80 PDF.
              </small>
              <button type="submit" disabled={subiendo}>
                {subiendo ? 'Trayendo los planes… (puede tardar un minuto)' : 'Traer e importar'}
              </button>
              {informeRuta && (
                <ul className="detalle resultado-ruta">
                  {informeRuta.resultados.map((r) => (
                    <li key={r.archivo} className={r.ok ? 'cumple' : 'no-cumple'}>
                      {r.ok ? `${r.nombre}${r.conIA ? ' (leído con IA)' : ''}` : `${r.archivo}: ${r.error}`}
                    </li>
                  ))}
                </ul>
              )}
            </form>
          )}
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
        <AdminPersonal avisar={avisar} />
        {matriz && (
          <div className="completo">
            <MatrizCarrera key={matriz.codigo} codigo={matriz.codigo} nombre={matriz.nombre} cerrar={() => setMatriz(null)} />
          </div>
        )}
      </div>

      <p className="aviso">🔒 Solo el administrador puede entrar a esta pantalla.</p>
    </main>
  );
}
