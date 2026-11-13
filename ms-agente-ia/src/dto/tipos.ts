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

// T46 · Materia de otra universidad: sus datos vienen del mensaje solicitud.enviada, no del catálogo
export interface PedidoExterno {
  codigoAprobada: string; // EXT-CALCULO-II
  nombre: string;
  silabo: string; // texto del sílabo
  codigoNueva: string; // materia de la FISEI elegida en T43
  creditos: number;
  horas: number;
  nota: number; // ya convertida sobre 10
  anio: number;
  parecido?: number; // 0 a 100, de T43
  notaOriginal?: number; // 16
  escala?: number; // 20
}

export type Resultado = 'Homologable' | 'No homologable' | 'Pendiente' | 'Sin materia equivalente';

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
  // T48 · solo materias de otra universidad
  parecido?: number;
  notaOriginal?: number;
  escala?: number;
  fecha?: string;
}
