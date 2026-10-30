export interface MateriaReglas {
  creditos: number;
  horas: number;
  nota?: number;
  anio?: number;
}

export interface EvaluarDto {
  origen: MateriaReglas; // materia aprobada
  destino: MateriaReglas; // materia de la nueva carrera
}

export interface ResultadoRegla {
  regla: string;
  cumple: boolean;
  causa: string;
}

export interface Evaluacion {
  homologable: boolean;
  reglas: ResultadoRegla[];
}

export interface ConfigReglas {
  creditosMinimo: number; // RN-02
  horasMinimo: number; // RN-03
  notaMinima: number; // RN-04
  maxAnios: number; // RN-05
}
