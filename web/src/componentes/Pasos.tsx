const PASOS = ['Solicitud', 'Materias', 'Resultado'];

export default function Pasos({ actual }: { actual: number }) {
  return (
    <ol className="pasos">
      {PASOS.map((nombre, i) => {
        const n = i + 1;
        const clase = n < actual ? 'hecho' : n === actual ? 'actual' : '';
        return (
          <li key={nombre} className={clase}>
            <span>{n < actual ? '✓' : n}</span>
            {nombre}
          </li>
        );
      })}
    </ol>
  );
}