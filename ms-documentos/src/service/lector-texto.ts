import { BadRequestException } from '@nestjs/common';

// pdf-parse 1.1.1 no trae tipos; se carga su archivo interno (igual que ms-catalogo) para evitar el modo de prueba de su index
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdf = require('pdf-parse/lib/pdf-parse.js') as (
  b: Uint8Array,
) => Promise<{ text: string }>;

export const MINIMO_CARACTERES = 200;

export async function leerTexto(buffer: Buffer): Promise<string> {
  let texto: string;
  try {
    // Se copia a un Uint8Array: pdf-parse no reconoce el Buffer cuando corre dentro de Jest
    texto = (await pdf(new Uint8Array(buffer))).text.trim();
  } catch {
    throw new BadRequestException('El archivo no es un PDF válido');
  }
  // Menos de 200 caracteres: casi seguro es una imagen escaneada
  if (texto.length < MINIMO_CARACTERES) {
    throw new BadRequestException(
      'El PDF no tiene texto; sube uno que se pueda copiar',
    );
  }
  return texto;
}
