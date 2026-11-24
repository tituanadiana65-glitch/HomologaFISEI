// Pasos de la homologación que hace el docente
const PASOS_DOCENTE = ['Expediente y materias', 'Análisis del agente', 'Revisión del docente', 'Enviada al coordinador'];

export default function Pasos({ actual, pasos = PASOS_DOCENTE }: { actual: number; pasos?: string[] }) {
  return (
    <ol className="pasos">
      {pasos.map((nombre, i) => {
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