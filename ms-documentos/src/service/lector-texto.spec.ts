import { leerTexto } from './lector-texto';
import { pdfConTexto, SILABO } from './pdf-de-prueba';

it('devuelve el texto de un PDF', async () => {
  const texto = await leerTexto(await pdfConTexto(SILABO));
  expect(texto).toContain('integrales');
});

it('rechaza un PDF sin texto (escaneado)', async () => {
  await expect(leerTexto(await pdfConTexto('Hoja 1'))).rejects.toThrow(
    'El PDF no tiene texto',
  );
});

it('rechaza un archivo que no es PDF', async () => {
  await expect(leerTexto(Buffer.from('no soy un pdf'))).rejects.toThrow(
    'no es un PDF válido',
  );
});
