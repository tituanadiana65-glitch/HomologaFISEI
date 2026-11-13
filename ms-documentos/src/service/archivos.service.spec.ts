import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArchivosService } from './archivos.service';
import { pdfConTexto, SILABO } from './pdf-de-prueba';

describe('ArchivosService', () => {
  let servicio: ArchivosService;

  beforeEach(async () => {
    servicio = new ArchivosService();
    servicio.carpeta = await mkdtemp(join(tmpdir(), 'archivos-'));
  });

  it('guarda el PDF y su texto con ids seguidos', async () => {
    const pdf = await pdfConTexto(SILABO);
    const a = await servicio.guardar('silabo.pdf', 'SILABO', pdf);
    const b = await servicio.guardar('malla.pdf', 'MALLA', pdf);
    expect(a).toMatchObject({ id: 1, nombre: 'silabo.pdf', tipo: 'SILABO' });
    expect(a.caracteres).toBeGreaterThan(200);
    expect(b.id).toBe(2);
    expect((await servicio.texto(1)).texto).toContain('integrales');
  });

  it('rechaza un tipo desconocido', async () => {
    await expect(
      servicio.guardar('x.pdf', 'FOTO', await pdfConTexto(SILABO)),
    ).rejects.toThrow('MALLA, RECORD o SILABO');
  });

  it('avisa si el archivo no existe', async () => {
    await expect(servicio.texto(99)).rejects.toThrow('No existe el archivo 99');
  });
});
