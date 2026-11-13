import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { leerTexto } from './lector-texto';

const TIPOS = ['MALLA', 'RECORD', 'SILABO'];

export interface Archivo {
  id: number;
  nombre: string;
  tipo: string;
  caracteres: number;
}

@Injectable()
export class ArchivosService {
  carpeta = process.env.ARCHIVOS_DIR || '/datos/archivos';

  // Guarda <id>.pdf, <id>.txt (texto leído) y <id>.json (datos del archivo)
  async guardar(
    nombre: string,
    tipo: string,
    contenido: Buffer,
  ): Promise<Archivo> {
    if (!TIPOS.includes(tipo))
      throw new BadRequestException('El tipo debe ser MALLA, RECORD o SILABO');
    const texto = await leerTexto(contenido);
    await mkdir(this.carpeta, { recursive: true });
    const id = (await this.ultimoId()) + 1;
    const archivo: Archivo = { id, nombre, tipo, caracteres: texto.length };
    await writeFile(join(this.carpeta, `${id}.pdf`), contenido);
    await writeFile(join(this.carpeta, `${id}.txt`), texto, 'utf8');
    await writeFile(
      join(this.carpeta, `${id}.json`),
      JSON.stringify(archivo),
      'utf8',
    );
    return archivo;
  }

  async texto(id: number): Promise<{ id: number; texto: string }> {
    try {
      return {
        id,
        texto: await readFile(join(this.carpeta, `${id}.txt`), 'utf8'),
      };
    } catch {
      throw new NotFoundException(`No existe el archivo ${id}`);
    }
  }

  private async ultimoId(): Promise<number> {
    const nombres = await readdir(this.carpeta);
    return nombres.reduce((max, n) => {
      const m = /^(\d+)\.json$/.exec(n);
      return m ? Math.max(max, Number(m[1])) : max;
    }, 0);
  }
}
