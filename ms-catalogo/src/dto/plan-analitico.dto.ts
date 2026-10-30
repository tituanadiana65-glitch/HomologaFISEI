// Formato de un plan analítico leído del PDF (lo comparten lector, guardado y carga).
export interface Requisito {
  codigo: string;
  nombre: string;
}

export interface Unidad {
  numero: number;
  horas: number;
  contenido: string;
}

export interface PlanAnalitico {
  codigo: string; // UTA-FISEI-TI-MP-UB-02-01
  nombre: string;
  carrera: string; // nombre de la carrera como sale en el PDF
  nivel: string;
  periodo: string;
  docente: string;
  unidadOrganizacional: string;
  creditos: number;
  horasTotales: number;
  prerrequisitos: Requisito[];
  correquisitos: Requisito[];
  objetivoGeneral: string;
  unidades: Unidad[];
}
