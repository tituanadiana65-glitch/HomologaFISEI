import { mkdtempSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Importador } from './importador';
import type { PlanesRepository } from '../repository/planes.repository';
import type { EventosService } from '../events/eventos.service';

// Importar planes por URL o ruta (observación del 24/11/2026)
const plan = readFileSync(join(__dirname, '../../test/fixtures/calculo-integral-sw.pdf'));
const respuesta = (cuerpo: unknown, tipo = 'application/json', ok = true) =>
  ({
    ok,
    headers: { get: () => tipo },
    json: () => Promise.resolve(cuerpo),
    text: () => Promise.resolve(String(cuerpo)),
    arrayBuffer: () => Promise.resolve(Buffer.isBuffer(cuerpo) ? cuerpo : Buffer.from(String(cuerpo))),
  }) as unknown as Response;

function armar(buscar: jest.Mock = jest.fn(), carpeta = '/no-existe') {
  const repo = { guardar: jest.fn((p: { codigo: string; nombre: string }, c: string) => Promise.resolve({ codigo: p.codigo, nombre: p.nombre, carrera: c, unidades: 4 })) };
  const eventos = { publicar: jest.fn().mockResolvedValue(true) };
  return { repo, imp: new Importador(repo as unknown as PlanesRepository, eventos as unknown as EventosService, buscar, carpeta) };
}

describe('Importador · por URL o ruta', () => {
  it('carpeta de GitHub: lista los PDF con la API y los importa', async () => {
    const buscar = jest.fn((url: string) =>
      Promise.resolve(
        url.startsWith('https://api.github.com')
          ? respuesta([
              { type: 'file', name: 'PlanAlitico CALCULO INTEGRAL.pdf', download_url: 'https://raw.example/c.pdf' },
              { type: 'file', name: 'leeme.txt', download_url: 'https://raw.example/l.txt' },
              { type: 'dir', name: 'otra', download_url: null },
            ])
          : respuesta(plan, 'application/pdf'),
      ),
    );
    const { imp, repo } = armar(buscar);
    const r = await imp.importarRuta('https://github.com/tituanadiana65-glitch/HomologaFISEI/tree/main/planes/SW');
    expect(buscar.mock.calls[0][0]).toBe('https://api.github.com/repos/tituanadiana65-glitch/HomologaFISEI/contents/planes/SW?ref=main');
    expect(r).toEqual({ total: 1, importados: 1, resultados: [expect.objectContaining({ archivo: 'PlanAlitico CALCULO INTEGRAL.pdf', ok: true, carrera: 'SW' })] });
    expect(repo.guardar).toHaveBeenCalledTimes(1);
  });

  it('página con enlaces: toma los enlaces a PDF (relativos y sin repetir)', async () => {
    const html = '<a href="planes/a.pdf">A</a> <a href="/b.PDF?v=1">B</a> <a href="planes/a.pdf">A</a> <a href="x.html">X</a>';
    const buscar = jest.fn().mockResolvedValue(respuesta(html, 'text/html'));
    const archivos = await armar(buscar).imp.resolver('https://fisei.uta.edu.ec/planes/');
    expect(archivos.map((a) => a.nombre)).toEqual(['a.pdf', 'b.PDF']);
  });

  it('un PDF suelto y un enlace "blob" de GitHub', async () => {
    const { imp } = armar(jest.fn());
    expect((await imp.resolver('https://servidor.edu/plan%20FISICA.pdf'))[0].nombre).toBe('plan FISICA.pdf');
    expect((await imp.resolver('https://github.com/a/b/blob/main/planes/x.pdf')).length).toBe(1);
  });

  it('carpeta del servidor: solo dentro de la carpeta de planes', async () => {
    const base = mkdtempSync(join(tmpdir(), 'planes-'));
    mkdirSync(join(base, 'SW'));
    writeFileSync(join(base, 'SW', 'a.pdf'), plan);
    writeFileSync(join(base, 'SW', 'nota.txt'), 'x');
    const { imp } = armar(jest.fn(), base);
    expect((await imp.resolver('planes/SW')).map((a) => a.nombre)).toEqual(['a.pdf']);
    await expect(imp.resolver('../../etc')).rejects.toThrow('fuera de la carpeta');
    await expect(imp.resolver('NO')).rejects.toThrow('No existe');
  });

  it('un archivo que falla no detiene a los demás', async () => {
    const buscar = jest.fn((url: string) => Promise.resolve(url.endsWith('mal.pdf') ? respuesta('basura', 'application/pdf') : respuesta(plan, 'application/pdf')));
    const html = '<a href="bien.pdf"></a><a href="mal.pdf"></a>';
    buscar.mockResolvedValueOnce(respuesta(html, 'text/html'));
    const r = await armar(buscar).imp.importarRuta('https://servidor.edu/planes/');
    expect(r.importados).toBe(1);
    expect(r.resultados.find((x) => !x.ok)?.error).toMatch(/no se pudo leer|no parece/);
  });

  it('un plan con otro formato se lee con IA si se indica la carrera', async () => {
    const otro = readFileSync(join(__dirname, '../../test/fixtures/otro-formato.pdf')); // sílabo de otra universidad (no es formato FISEI)
    const { imp, repo } = armar(
      jest.fn().mockResolvedValue(
        respuesta({ nombre: 'Robótica Básica', nivel: 'PRIMERO', creditos: 3, horasTotales: 144, unidades: [{ contenido: 'Sensores', horas: 72 }, { contenido: 'Actuadores', horas: 72 }] }),
      ),
    );
    await expect(imp.importarBuffer('robotica.pdf', otro)).rejects.toThrow('Indica la carrera');
    const r = await imp.importarBuffer('robotica.pdf', otro, 'ro');
    expect(r.conIA).toBe(true);
    expect(repo.guardar).toHaveBeenCalledWith(expect.objectContaining({ codigo: 'RO-ROBOTICA-BASICA', nombre: 'ROBÓTICA BÁSICA', unidades: [expect.objectContaining({ numero: 1, contenido: 'Sensores' }), expect.anything()] }), 'RO');
  });
});
