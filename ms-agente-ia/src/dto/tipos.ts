export interface UnidadTexto {
  numero: number;
  contenido: string;
}

export interface MateriaTexto {
  codigo: string;
  nombre: string;
  objetivoGeneral?: string;
  unidades: UnidadTexto[];
}

// Materia como la devuelve ms-catalogo (GET /asignaturas/:codigo)
export interface MateriaCatalogo extends MateriaTexto {
  creditos: number;
  horasTotales: number;
  nivel?: string;
  carrera?: { codigo: string; nombre: string };
  requisitos?: { tipo: string; codigo: string; nombre: string }[];
}

export interface Comparacion {
  disponible: boolean; // false si no se pudo consultar a la IA
  cumple: boolean;
  porcentaje: number;
  coinciden: string[];
  faltan: string[];
  explicacion: string;
}

export interface Causa {
  regla: string;
  cumple: boolean;
  causa: string;
}

// Respuesta de ms-motor-reglas (POST /evaluar)
export interface ResultadoReglas {
  homologable: boolean;
  reglas: Causa[];
}

export interface PedidoComparar {
  codigoAprobada: string;
  codigoNueva: string;
}

export interface PedidoHomologar extends PedidoComparar {
  nota?: number;
  anio?: number;
}

export type Resultado = 'Homologable' | 'No homologable' | 'Pendiente';

export interface Informe {
  id?: number;
  aprobada: string;
  nueva: string;
  resultado: Resultado;
  porcentaje: number;
  causas: Causa[];
  temasCoinciden: string[];
  temasFaltan: string[];
  prerrequisitosNueva: string[];
  fecha?: string;
}
