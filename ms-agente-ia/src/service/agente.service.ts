import { Injectable, Logger } from '@nestjs/common';
import type { Comparacion, MateriaTexto } from '../dto/tipos';

// Instrucciones del agente: solo compara contenidos (RN-01).
// Créditos, horas, nota y vigencia los decide ms-motor-reglas, no la IA.
export const SISTEMA = `Eres el agente de homologación de la Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI) de la Universidad Técnica de Ambato.
Comparas los contenidos de una MATERIA APROBADA por un estudiante con los de una MATERIA NUEVA de la carrera a la que se cambia.
Calcula qué porcentaje de los temas de la MATERIA NUEVA están cubiertos por la MATERIA APROBADA.
Reglas:
- Usa solo el texto que recibes; no inventes temas.
- Un tema cuenta como cubierto si su contenido es equivalente, aunque esté redactado distinto.
- No consideres créditos, horas, notas ni fechas: eso lo evalúa otro servicio.
- Escribe los temas en palabras, sin fórmulas, sin LaTeX y sin barras invertidas.
Responde SOLO con un objeto JSON, sin texto antes ni después:
{"porcentaje": número de 0 a 100, "coinciden": ["tema", ...], "faltan": ["tema de la materia nueva que no está cubierto", ...], "explicacion": "2 o 3 frases en español sencillo"}`;

// T43 · Instrucciones para elegir, entre las materias de la FISEI, la más parecida a un sílabo de otra universidad.
export const SISTEMA_PARECIDA = `Eres el agente de homologación de la Facultad de Ingeniería en Sistemas, Electrónica e Industrial (FISEI) de la Universidad Técnica de Ambato.
Recibes el SÍLABO de una materia aprobada en otra universidad y una lista de MATERIAS CANDIDATAS de la FISEI (código | nombre | temas de cada unidad).
Elige la candidata cuyos temas sean más parecidos a los del sílabo.
Reglas:
- Usa solo el texto que recibes; no inventes temas.
- Compara por temas, no solo por el nombre de la materia.
- "parecido" es un número de 0 a 100 que indica qué tanto se parecen los temas.
- Si ninguna se parece, devuelve la más cercana con un "parecido" bajo.
Responde SOLO con un objeto JSON, sin texto antes ni después:
{"codigo": "código exacto de la candidata elegida", "parecido": número de 0 a 100}`;

// El sílabo se recorta para no pasar el límite gratuito de la IA (T44)
export const MAX_SILABO = 12_000;
export const recortar = (t: string, max = MAX_SILABO) => (t.length > max ? `${t.slice(0, max)}…` : t);

// Porcentaje mínimo de parecido para aceptar la materia elegida (T43)
export const PARECIDO_MINIMO = 50;

const texto = (m: MateriaTexto) =>
  [
    `${m.nombre} (${m.codigo})`,
    m.objetivoGeneral ? `Objetivo: ${m.objetivoGeneral}` : '',
    ...m.unidades.map((u) => `Unidad ${u.numero}: ${u.contenido}`),
  ]
    .filter(Boolean)
    .join('\n');

export function armarPedido(aprobada: MateriaTexto, nueva: MateriaTexto): string {
  return `MATERIA APROBADA:\n${texto(aprobada)}\n\nMATERIA NUEVA:\n${texto(nueva)}`;
}

// T44 · Igual que armarPedido, pero la materia aprobada es el texto de su sílabo (de otra universidad)
export function armarPedidoSilabo(silabo: string, nueva: MateriaTexto): string {
  return `MATERIA APROBADA (sílabo de otra universidad):\n${recortar(silabo)}\n\nMATERIA NUEVA:\n${texto(nueva)}`;
}

// T43 · Candidatas en una línea cada una: "código | nombre | temas de cada unidad (80 letras)"
export function armarPedidoParecida(silabo: string, candidatas: MateriaTexto[]): string {
  const lista = candidatas.map((c) => {
    const temas = c.unidades.map((u) => (u.contenido.length > 80 ? `${u.contenido.slice(0, 80)}…` : u.contenido));
    return `${c.codigo} | ${c.nombre} | ${temas.join('; ')}`;
  });
  return `SÍLABO:\n${recortar(silabo)}\n\nMATERIAS CANDIDATAS:\n${lista.join('\n')}`;
}

// T43 · Lee { codigo, parecido }. Si la IA inventa un código que no está en la lista, falla (queda Pendiente).
export function leerParecida(respuesta: string, candidatas: { codigo: string }[]): { codigo: string; parecido: number } {
  let json: { codigo?: unknown; parecido?: unknown };
  try {
    json = JSON.parse(limpiarJson(respuesta)) as { codigo?: unknown; parecido?: unknown };
  } catch {
    throw new Error('la IA no devolvió un JSON válido');
  }
  const codigo = typeof json.codigo === 'string' ? json.codigo : '';
  const parecido = Number(json.parecido);
  if (!candidatas.some((c) => c.codigo === codigo)) throw new Error('la IA eligió una materia que no está en la lista');
  if (Number.isNaN(parecido)) throw new Error('la respuesta no trae parecido');
  return { codigo, parecido: Math.max(0, Math.min(100, parecido)) };
}

// Deja el JSON listo para leer: quita ```json ... ``` y arregla barras invertidas sueltas
// (por ejemplo fórmulas como \int o \frac que rompen JSON.parse).
export function limpiarJson(respuesta: string): string {
  const sinBloques = respuesta.replace(/```(?:json)?/gi, '');
  const json = sinBloques.slice(sinBloques.indexOf('{'), sinBloques.lastIndexOf('}') + 1);
  // Recorre los escapes de a pares: los válidos se quedan igual, los sueltos se duplican
  return json.replace(/\\(["\\/bfnrt]|u[0-9a-fA-F]{4})?/g, (todo, valido?: string) => (valido ? todo : '\\\\'));
}

export function leerRespuesta(respuesta: string, minimo: number): Comparacion {
  let json: Partial<Comparacion>;
  try {
    json = JSON.parse(limpiarJson(respuesta)) as Partial<Comparacion>;
  } catch {
    // Último recurso: tomar al menos el porcentaje del texto
    const m = respuesta.match(/"porcentaje"\s*:\s*(\d+(?:\.\d+)?)/);
    if (!m) throw new Error('la IA no devolvió un JSON válido');
    json = { porcentaje: Number(m[1]), explicacion: 'La IA calculó el porcentaje, pero su explicación no se pudo leer.' };
  }
  const porcentaje = Math.max(0, Math.min(100, Number(json.porcentaje)));
  if (Number.isNaN(porcentaje)) throw new Error('La respuesta no trae porcentaje');
  return {
    disponible: true,
    cumple: porcentaje >= minimo,
    porcentaje,
    coinciden: Array.isArray(json.coinciden) ? json.coinciden.map(String) : [],
    faltan: Array.isArray(json.faltan) ? json.faltan.map(String) : [],
    explicacion: typeof json.explicacion === 'string' ? json.explicacion : '',
  };
}

export const SIN_IA: Omit<Comparacion, 'explicacion'> = {
  disponible: false,
  cumple: false,
  porcentaje: 0,
  coinciden: [],
  faltan: [],
};

// Proveedores de IA con API compatible con OpenAI (chat/completions).
// Gemini y Groq tienen plan gratuito sin tarjeta; Ollama corre local en la PC, sin clave.
export interface Proveedor {
  nombre: string;
  url: string;
  modelo: string;
  respaldo: string[]; // modelos que se prueban si el principal está saturado
  necesitaClave: boolean;
  formato: 'openai' | 'anthropic'; // forma de la API: chat/completions de OpenAI o messages de Claude
}

export const PROVEEDORES: Record<string, Proveedor> = {
  gemini: {
    nombre: 'Gemini (Google)',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    modelo: 'gemini-flash-latest',
    respaldo: ['gemini-2.5-flash', 'gemini-flash-lite-latest'],
    necesitaClave: true,
    formato: 'openai',
  },
  groq: {
    nombre: 'Groq',
    url: 'https://api.groq.com/openai/v1',
    modelo: 'llama-3.3-70b-versatile',
    respaldo: ['llama-3.1-8b-instant'],
    necesitaClave: true,
    formato: 'openai',
  },
  ollama: {
    nombre: 'Ollama (local)',
    url: 'http://host.docker.internal:11434/v1',
    modelo: 'qwen2.5:7b',
    respaldo: [],
    necesitaClave: false,
    formato: 'openai',
  },
  // API de Claude (Anthropic): de pago, la clave empieza con "sk-ant-" (console.anthropic.com)
  claude: {
    nombre: 'Claude (Anthropic)',
    url: 'https://api.anthropic.com/v1',
    modelo: 'claude-sonnet-5-5',
    respaldo: ['claude-haiku-5-5'],
    necesitaClave: true,
    formato: 'anthropic',
  },
};

export function proveedorActual(env: NodeJS.ProcessEnv = process.env): Proveedor & { clave: string } {
  const base = PROVEEDORES[(env.IA_PROVEEDOR || 'gemini').toLowerCase()];
  if (!base) throw new Error(`IA_PROVEEDOR "${env.IA_PROVEEDOR}" no existe. Usa: ${Object.keys(PROVEEDORES).join(', ')}`);
  return { ...base, url: env.IA_URL || base.url, modelo: env.IA_MODELO || base.modelo, clave: env.IA_API_KEY || '' };
}

interface RespuestaChat {
  choices?: { message?: { content?: string | null } }[]; // formato OpenAI
  content?: { type?: string; text?: string }[]; // formato Claude
  error?: { message?: string } | { message?: string }[];
}

@Injectable()
export class AgenteService {
  private readonly log = new Logger(AgenteService.name);

  // Espera entre reintentos (se puede cambiar en las pruebas)
  esperar = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  // Prueba el modelo principal y, si está saturado o no existe, los de respaldo.
  // Ante saturación (429/500/503) reintenta el mismo modelo con espera creciente.
  async llamarIA(pedido: string, sistema: string = SISTEMA): Promise<string> {
    const p = proveedorActual();
    if (p.necesitaClave && !p.clave) throw new Error(`Falta IA_API_KEY en el archivo .env (${p.nombre})`);
    const modelos = [p.modelo, ...p.respaldo.filter((m) => m !== p.modelo)];
    let ultimo = '';
    for (const modelo of modelos) {
      for (const espera of [0, 2000, 5000]) {
        if (espera) await this.esperar(espera);
        const r = await this.consultar(p, modelo, pedido, sistema);
        if (r.ok) return r.texto;
        ultimo = r.motivo;
        if (r.status === 401 || r.status === 403 || /api key/i.test(r.motivo)) throw new Error(`${p.nombre}: ${r.motivo}`);
        if (r.status === 400 || r.status === 404) break; // modelo no disponible: probar el siguiente
        this.log.warn(`${p.nombre} ${modelo}: ${r.motivo}. Reintentando…`);
      }
    }
    throw new Error(`${p.nombre}: ${ultimo}`);
  }

  // Arma la llamada HTTP según el formato de la API (OpenAI/Gemini/Groq/Ollama o Claude)
  private pedidoHttp(p: Proveedor & { clave: string }, modelo: string, pedido: string, sistema: string): { url: string; headers: Record<string, string>; body: object } {
    if (p.formato === 'anthropic') {
      return {
        url: `${p.url}/messages`,
        headers: { 'Content-Type': 'application/json', 'x-api-key': p.clave, 'anthropic-version': '2023-06-01' },
        body: { model: modelo, max_tokens: 2048, system: sistema, messages: [{ role: 'user', content: pedido }] },
      };
    }
    return {
      url: `${p.url}/chat/completions`,
      headers: { 'Content-Type': 'application/json', ...(p.clave ? { Authorization: `Bearer ${p.clave}` } : {}) },
      body: {
        model: modelo,
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: pedido },
        ],
      },
    };
  }

  private async consultar(p: Proveedor & { clave: string }, modelo: string, pedido: string, sistema: string) {
    let r: Response;
    try {
      const h = this.pedidoHttp(p, modelo, pedido, sistema);
      r = await fetch(h.url, { method: 'POST', headers: h.headers, body: JSON.stringify(h.body), signal: AbortSignal.timeout(90_000) });
    } catch (e) {
      return { ok: false as const, status: 503, motivo: `sin conexión (${(e as Error).message})`, texto: '' };
    }
    const crudo = (await r.json().catch(() => ({}))) as RespuestaChat | RespuestaChat[];
    const datos = Array.isArray(crudo) ? (crudo[0] ?? {}) : crudo; // Gemini a veces responde [ {...} ]
    if (r.ok) {
      const texto = p.formato === 'anthropic' ? (datos.content?.find((b) => b.type === 'text')?.text ?? '') : (datos.choices?.[0]?.message?.content ?? '');
      return { ok: true as const, status: r.status, motivo: '', texto };
    }
    const e = Array.isArray(datos.error) ? datos.error[0] : datos.error;
    const motivo =
      r.status === 429
        ? 'se alcanzó el límite gratuito, espera un minuto'
        : r.status === 401 || r.status === 403
          ? 'la clave IA_API_KEY no es válida'
          : e?.message || `error ${r.status}`;
    return { ok: false as const, status: r.status, motivo, texto: '' };
  }

  // T44 · Compara el sílabo de otra universidad con el plan analítico de la FISEI (RN-01).
  // Mismo resultado que comparar(): porcentaje, temas que coinciden, temas que faltan y explicación.
  async compararConSilabo(silabo: string, nueva: MateriaTexto, minimo = 80): Promise<Comparacion> {
    try {
      return leerRespuesta(await this.llamarIA(armarPedidoSilabo(silabo, nueva)), minimo);
    } catch (e) {
      this.log.warn(`No se pudo consultar al agente: ${(e as Error).message}`);
      return { ...SIN_IA, explicacion: `No se pudo consultar al agente de IA (${(e as Error).message}); falta el análisis de contenidos.` };
    }
  }

  // T43 · Elige la materia de la FISEI más parecida al sílabo. Devuelve null si el parecido es menor a 50.
  // Si la IA falla, lanza el error (la solicitud deja esa materia en "Pendiente").
  async elegirParecida(silabo: string, candidatas: MateriaTexto[], minimo = PARECIDO_MINIMO) {
    const r = leerParecida(await this.llamarIA(armarPedidoParecida(silabo, candidatas), SISTEMA_PARECIDA), candidatas);
    return r.parecido < minimo ? null : r;
  }

  // minimo = porcentaje de RN-01 (por defecto 80)
  async comparar(aprobada: MateriaTexto, nueva: MateriaTexto, minimo = 80): Promise<Comparacion> {
    try {
      return leerRespuesta(await this.llamarIA(armarPedido(aprobada, nueva)), minimo);
    } catch (e) {
      this.log.warn(`No se pudo consultar al agente: ${(e as Error).message}`);
      return { ...SIN_IA, explicacion: `No se pudo consultar al agente de IA (${(e as Error).message}); falta el análisis de contenidos.` };
    }
  }
}
