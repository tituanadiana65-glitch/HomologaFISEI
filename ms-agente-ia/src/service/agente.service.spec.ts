import { AgenteService, armarPedido, armarPedidoParecida, armarPedidoSilabo, leerParecida, leerRespuesta, proveedorActual, recortar } from './agente.service';
import type { MateriaTexto } from '../dto/tipos';

const fisicaTI: MateriaTexto = { codigo: 'TI-FIS', nombre: 'Física', unidades: [{ numero: 1, contenido: 'Leyes de Newton' }] };
const fisicaSW: MateriaTexto = { codigo: 'SW-FIS', nombre: 'Física', unidades: [{ numero: 1, contenido: 'Dinámica, leyes de Newton' }] };

const ENV_ORIGINAL = { ...process.env };

describe('AgenteService', () => {
  const s = new AgenteService();
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...ENV_ORIGINAL };
  });

  it('80 % o más de coincidencia cumple RN-01', async () => {
    jest.spyOn(s, 'llamarIA').mockResolvedValue('{"porcentaje":92,"coinciden":["Leyes de Newton"],"faltan":[],"explicacion":"Mismos temas."}');
    const r = await s.comparar(fisicaTI, fisicaSW);
    expect(r).toMatchObject({ disponible: true, cumple: true, porcentaje: 92 });
  });

  it('menos de 80 % no cumple', async () => {
    jest.spyOn(s, 'llamarIA').mockResolvedValue('{"porcentaje":55,"coinciden":[],"faltan":["Rotación"],"explicacion":"Faltan temas."}');
    const r = await s.comparar(fisicaTI, fisicaSW);
    expect(r.cumple).toBe(false);
    expect(r.faltan).toEqual(['Rotación']);
  });

  it('usa el mínimo configurado en RN-01', async () => {
    jest.spyOn(s, 'llamarIA').mockResolvedValue('{"porcentaje":75}');
    expect((await s.comparar(fisicaTI, fisicaSW, 70)).cumple).toBe(true);
  });

  it('si la IA falla, avisa que falta el análisis', async () => {
    jest.spyOn(s, 'llamarIA').mockRejectedValue(new Error('sin conexión'));
    const r = await s.comparar(fisicaTI, fisicaSW);
    expect(r.disponible).toBe(false);
    expect(r.explicacion).toContain('falta el análisis de contenidos');
  });

  it('lee JSON con barras invertidas de fórmulas (\\int) y bloques ```json', () => {
    const r = leerRespuesta('```json\n{"porcentaje": 90, "coinciden": ["Integral \\int f(x)dx"], "faltan": [], "explicacion": "Usa \\frac y \\u00e1"}\n```', 80);
    expect(r.porcentaje).toBe(90);
    expect(r.coinciden[0]).toContain('int f(x)dx');
    expect(r.explicacion).toContain('á');
  });

  it('no daña un JSON que ya tenía barras escapadas bien', () => {
    expect(leerRespuesta('{"porcentaje": 70, "explicacion": "ruta C:\\\\temas"}', 80).explicacion).toBe('ruta C:\\temas');
  });

  it('si el JSON está roto igual toma el porcentaje', () => {
    expect(leerRespuesta('{"porcentaje": 85, "coinciden": ["a" "b"]}', 80).porcentaje).toBe(85);
  });

  it('lee el JSON aunque venga con texto alrededor', () => {
    expect(leerRespuesta('Claro: {"porcentaje": 81} listo', 80).cumple).toBe(true);
  });

  it('arma el pedido con las unidades de ambas materias', () => {
    const p = armarPedido(fisicaTI, fisicaSW);
    expect(p).toContain('MATERIA APROBADA');
    expect(p).toContain('Unidad 1: Dinámica, leyes de Newton');
  });

  it('usa Gemini por defecto y permite cambiar a Groq u Ollama', () => {
    expect(proveedorActual({}).nombre).toBe('Gemini (Google)');
    expect(proveedorActual({ IA_PROVEEDOR: 'groq', IA_API_KEY: 'x' })).toMatchObject({ nombre: 'Groq', clave: 'x' });
    expect(proveedorActual({ IA_PROVEEDOR: 'ollama' }).necesitaClave).toBe(false);
    expect(proveedorActual({ IA_MODELO: 'gemini-3.8-flash' }).modelo).toBe('gemini-3.8-flash');
  });

  it('llama a la API compatible con OpenAI y devuelve el texto', async () => {
    const original = { ...process.env };
    process.env.IA_PROVEEDOR = 'gemini';
    process.env.IA_API_KEY = 'clave-prueba';
    const espia = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: '{"porcentaje":90}' } }] }), { status: 200 }),
    );
    expect(await new AgenteService().llamarIA('hola')).toBe('{"porcentaje":90}');
    const [url, opciones] = espia.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect((opciones.headers as Record<string, string>).Authorization).toBe('Bearer clave-prueba');
    espia.mockRestore();
    process.env = original;
  });

  it('explica el límite gratuito cuando la API responde 429', async () => {
    const original = { ...process.env };
    process.env.IA_API_KEY = 'x';
    const espia = jest.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('{}', { status: 429 })));
    const s2 = new AgenteService();
    s2.esperar = () => Promise.resolve();
    await expect(s2.llamarIA('hola')).rejects.toThrow('límite gratuito');
    espia.mockRestore();
    process.env = original;
  });

  it('entiende el error de Gemini cuando viene dentro de una lista', async () => {
    const original = { ...process.env };
    process.env.IA_API_KEY = 'x';
    const espia = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify([{ error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } }]), { status: 400 }),
    );
    const s3 = new AgenteService();
    s3.esperar = () => Promise.resolve();
    await expect(s3.llamarIA('hola')).rejects.toThrow('API key not valid');
    espia.mockRestore();
    process.env = original;
  });

  it('si Gemini está saturado reintenta y luego usa un modelo de respaldo', async () => {
    const original = { ...process.env };
    process.env.IA_PROVEEDOR = 'gemini';
    process.env.IA_API_KEY = 'x';
    const saturado = () => new Response(JSON.stringify([{ error: { code: 503, message: 'This model is currently experiencing high demand.' } }]), { status: 503 });
    const espia = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(saturado())
      .mockResolvedValueOnce(saturado())
      .mockResolvedValueOnce(saturado())
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: '{"porcentaje":88}' } }] }), { status: 200 }));
    const s4 = new AgenteService();
    s4.esperar = () => Promise.resolve();
    expect(await s4.llamarIA('hola')).toBe('{"porcentaje":88}');
    const modelos = espia.mock.calls.map((c) => (JSON.parse((c[1] as RequestInit).body as string) as { model: string }).model);
    expect(modelos).toEqual(['gemini-flash-latest', 'gemini-flash-latest', 'gemini-flash-latest', 'gemini-2.5-flash']);
    espia.mockRestore();
    process.env = original;
  });

  it('con clave inválida no reintenta', async () => {
    const original = { ...process.env };
    process.env.IA_API_KEY = 'x';
    const espia = jest.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('{}', { status: 401 })));
    await expect(new AgenteService().llamarIA('hola')).rejects.toThrow('no es válida');
    expect(espia).toHaveBeenCalledTimes(1);
    espia.mockRestore();
    process.env = original;
  });

  // ---------- T43 · materia más parecida ----------
  const candidatas: MateriaTexto[] = [
    { codigo: 'SW-CI', nombre: 'CÁLCULO INTEGRAL', unidades: [{ numero: 1, contenido: 'Integral indefinida y técnicas de integración' }] },
    { codigo: 'SW-FIS', nombre: 'FÍSICA', unidades: [{ numero: 1, contenido: 'Leyes de Newton' }] },
  ];

  it('T43: arma la lista de candidatas con código, nombre y temas', () => {
    const p = armarPedidoParecida('Integrales dobles', candidatas);
    expect(p).toContain('SÍLABO:\nIntegrales dobles');
    expect(p).toContain('SW-CI | CÁLCULO INTEGRAL | Integral indefinida y técnicas de integración');
    expect(p).toContain('SW-FIS | FÍSICA | Leyes de Newton');
  });

  it('T43: recorta un sílabo muy largo', () => {
    expect(recortar('a'.repeat(20_000))).toHaveLength(12_001);
    expect(recortar('corto')).toBe('corto');
  });

  it('T43: lee { codigo, parecido }', () => {
    expect(leerParecida('{"codigo":"SW-CI","parecido":85}', candidatas)).toEqual({ codigo: 'SW-CI', parecido: 85 });
    expect(leerParecida('Claro:\n```json\n{"codigo":"SW-CI","parecido":120}\n```', candidatas).parecido).toBe(100);
  });

  it('T43: rechaza un código que la IA inventó o un JSON roto', () => {
    expect(() => leerParecida('{"codigo":"XX","parecido":90}', candidatas)).toThrow('no está en la lista');
    expect(() => leerParecida('no es json', candidatas)).toThrow('JSON válido');
    expect(() => leerParecida('{"codigo":"SW-CI"}', candidatas)).toThrow('parecido');
  });

  it('T43: elige bien (Cálculo II -> Cálculo Integral)', async () => {
    jest.spyOn(s, 'llamarIA').mockResolvedValue('{"codigo":"SW-CI","parecido":82}');
    expect(await s.elegirParecida('Cálculo II: integrales', candidatas)).toEqual({ codigo: 'SW-CI', parecido: 82 });
  });

  it('T43: con parecido menor a 50 devuelve null (sin equivalente)', async () => {
    jest.spyOn(s, 'llamarIA').mockResolvedValue('{"codigo":"SW-FIS","parecido":30}');
    expect(await s.elegirParecida('Literatura', candidatas)).toBeNull();
  });

  it('T43: si la IA falla, lanza el error', async () => {
    jest.spyOn(s, 'llamarIA').mockRejectedValue(new Error('sin conexión'));
    await expect(s.elegirParecida('x', candidatas)).rejects.toThrow('sin conexión');
  });

  // ---------- proveedor Claude ----------
  it('Claude: se elige con IA_PROVEEDOR=claude', () => {
    expect(proveedorActual({ IA_PROVEEDOR: 'claude', IA_API_KEY: 'sk-ant-x' })).toMatchObject({
      nombre: 'Claude (Anthropic)', modelo: 'claude-sonnet-5-5', formato: 'anthropic', clave: 'sk-ant-x',
    });
  });

  it('Claude: llama a /v1/messages con x-api-key y lee el texto', async () => {
    process.env.IA_PROVEEDOR = 'claude';
    process.env.IA_API_KEY = 'sk-ant-prueba';
    const espia = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ content: [{ type: 'text', text: '{"porcentaje":90}' }] }), { status: 200 }),
    );
    expect(await new AgenteService().llamarIA('hola', 'eres un agente')).toBe('{"porcentaje":90}');
    const [url, opciones] = espia.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    const h = opciones.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('sk-ant-prueba');
    expect(h['anthropic-version']).toBe('2023-06-01');
    expect(JSON.parse(opciones.body as string)).toMatchObject({
      model: 'claude-sonnet-5-5', system: 'eres un agente', messages: [{ role: 'user', content: 'hola' }],
    });
  });

  it('Claude: con clave inválida (401) no reintenta', async () => {
    process.env.IA_PROVEEDOR = 'claude';
    process.env.IA_API_KEY = 'mala';
    const espia = jest.spyOn(globalThis, 'fetch').mockImplementation(() => Promise.resolve(new Response('{}', { status: 401 })));
    await expect(new AgenteService().llamarIA('hola')).rejects.toThrow('no es válida');
    expect(espia).toHaveBeenCalledTimes(1);
  });

  it('Claude: si está saturado (529) reintenta y luego usa el modelo de respaldo', async () => {
    process.env.IA_PROVEEDOR = 'claude';
    process.env.IA_API_KEY = 'x';
    const saturado = () => new Response(JSON.stringify({ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }), { status: 529 });
    const espia = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(saturado())
      .mockResolvedValueOnce(saturado())
      .mockResolvedValueOnce(saturado())
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 }));
    const c = new AgenteService();
    c.esperar = () => Promise.resolve();
    expect(await c.llamarIA('hola')).toBe('ok');
    const modelos = espia.mock.calls.map((x) => (JSON.parse((x[1] as RequestInit).body as string) as { model: string }).model);
    expect(modelos).toEqual(['claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5']);
  });

  // ---------- T44 · sílabo frente al plan analítico ----------
  const calculoSW: MateriaTexto = { codigo: 'SW-CI', nombre: 'CÁLCULO INTEGRAL', unidades: [{ numero: 1, contenido: 'Integral indefinida' }, { numero: 2, contenido: 'Integral definida' }] };

  it('T44: el pedido lleva el sílabo y las unidades de la materia nueva', () => {
    const p = armarPedidoSilabo('Integrales y series', calculoSW);
    expect(p).toContain('MATERIA APROBADA (sílabo de otra universidad):\nIntegrales y series');
    expect(p).toContain('MATERIA NUEVA:\nCÁLCULO INTEGRAL (SW-CI)');
    expect(p).toContain('Unidad 2: Integral definida');
  });

  it('T44: un sílabo muy largo se recorta a 12 000 caracteres', () => {
    const p = armarPedidoSilabo('x'.repeat(50_000), calculoSW);
    expect(p.length).toBeLessThan(13_000);
  });

  it('T44: compara con IA simulada y devuelve porcentaje, coinciden, faltan y explicación', async () => {
    jest.spyOn(s, 'llamarIA').mockResolvedValue('{"porcentaje":78,"coinciden":["Integral indefinida"],"faltan":["Integral definida"],"explicacion":"Falta un tema."}');
    const r = await s.compararConSilabo('Integrales y series', calculoSW);
    expect(r).toMatchObject({ disponible: true, cumple: false, porcentaje: 78, faltan: ['Integral definida'] });
  });

  it('T44: usa el mínimo configurado en RN-01', async () => {
    jest.spyOn(s, 'llamarIA').mockResolvedValue('{"porcentaje":75}');
    expect((await s.compararConSilabo('x', calculoSW, 70)).cumple).toBe(true);
  });

  it('T44: si la IA falla, avisa que falta el análisis', async () => {
    jest.spyOn(s, 'llamarIA').mockRejectedValue(new Error('sin conexión'));
    const r = await s.compararConSilabo('x', calculoSW);
    expect(r.disponible).toBe(false);
    expect(r.explicacion).toContain('falta el análisis de contenidos');
  });
});
