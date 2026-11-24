import { useEffect, useState } from 'react';
import { api } from '../api';

// Matriz de la carrera (observación del 24/11/2026): Carrera | Materia | Nivel | Unidades | Créditos | Horas.
// El agente compara el récord contra esta matriz; aquí el administrador la revisa y la descarga en CSV (se abre en Excel).
interface Fila {
  codigo: string;
  nombre: string;
  nivel: string;
  creditos: number;
  horasTotales: number;
  unidades: { numero: number; horas: number; contenido: string }[];
}

const celda = (v: string | number) => `"${String(v).replace(/"/g, '""').replace(/\s+/g, ' ').trim()}"`;

function matrizCsv(carrera: string, filas: Fila[]): string {
  const encabezado = ['Carrera', 'Código', 'Materia', 'Nivel', 'Contenidos / unidades', 'Créditos', 'Horas'];
  const lineas = filas.map((f) =>
    [carrera, f.codigo, f.nombre, f.nivel, f.unidades.map((u) => `Unidad ${u.numero}: ${u.contenido}`).join(' | '), f.creditos, f.horasTotales]
      .map(celda)
      .join(';'),
  );
  // ";" y BOM para que Excel en español lo abra con tildes y en columnas
  return `\uFEFF${[encabezado.map(celda).join(';'), ...lineas].join('\r\n')}`;
}

export default function MatrizCarrera({ codigo, nombre, cerrar }: { codigo: string; nombre: string; cerrar: () => void }) {
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [abierta, setAbierta] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<Fila[]>(`/catalogo/matriz?carrera=${encodeURIComponent(codigo)}`)
      .then(setFilas)
      .catch((e: Error) => setError(e.message));
  }, [codigo]);

  const descargar = () => {
    if (!filas) return;
    const url = URL.createObjectURL(new Blob([matrizCsv(nombre, filas)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `matriz-${codigo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="admin-tarjeta matriz">
      <div className="matriz-cabecera">
        <div>
          <h2>
            Matriz de {nombre} ({codigo})
          </h2>
          <small className="nota">El agente compara las materias aprobadas del récord contra esta matriz.</small>
        </div>
        <div className="botones-regla">
          <button className="pequeno" disabled={!filas?.length} onClick={descargar}>
            Descargar CSV (Excel)
          </button>
          <button className="enlace" onClick={cerrar}>
            Cerrar
          </button>
        </div>
      </div>
      {error && <p role="alert">{error}</p>}
      {!filas && !error && <p className="nota">Cargando…</p>}
      {filas && (
        <table>
          <thead>
            <tr>
              <th>Materia</th>
              <th>Nivel</th>
              <th>Contenidos / unidades</th>
              <th>Créditos</th>
              <th>Horas</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.codigo}>
                <td>
                  <strong>{f.nombre}</strong>
                  <small className="equivale">{f.codigo}</small>
                </td>
                <td>{f.nivel}</td>
                <td>
                  {abierta === f.codigo ? (
                    <ol className="unidades">
                      {f.unidades.map((u) => (
                        <li key={u.numero}>{u.contenido}</li>
                      ))}
                    </ol>
                  ) : (
                    <span className="resumen-unidades">{f.unidades.map((u) => u.contenido.split(/[.:;]/)[0]).join(' · ')}</span>
                  )}
                  {f.unidades.length > 0 && (
                    <button className="enlace" onClick={() => setAbierta(abierta === f.codigo ? '' : f.codigo)}>
                      {abierta === f.codigo ? 'Ver menos' : f.unidades.length === 1 ? 'Ver la unidad' : `Ver las ${f.unidades.length} unidades`}
                    </button>
                  )}
                </td>
                <td>{f.creditos}</td>
                <td>{f.horasTotales}</td>
              </tr>
            ))}
            {filas.length === 0 && (
              <tr>
                <td colSpan={5} className="vacio">
                  Esta carrera todavía no tiene planes analíticos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
