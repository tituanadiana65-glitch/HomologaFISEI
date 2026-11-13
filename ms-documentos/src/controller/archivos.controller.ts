import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ArchivosService } from '../service/archivos.service';

interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}

@Controller('archivos')
export class ArchivosController {
  constructor(private readonly archivos: ArchivosService) {}

  // POST /api/documentos/archivos (formulario con "archivo" y "tipo")
  @Post()
  @UseInterceptors(
    FileInterceptor('archivo', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  subir(
    @UploadedFile() archivo: ArchivoSubido | undefined,
    @Body('tipo') tipo: string,
  ) {
    if (!archivo) throw new BadRequestException('Falta el archivo PDF');
    if (archivo.mimetype !== 'application/pdf')
      throw new BadRequestException('Solo se aceptan archivos PDF');
    // multer entrega el nombre en latin1; así se conservan las tildes (Cálculo.pdf)
    const nombre = Buffer.from(archivo.originalname, 'latin1').toString('utf8');
    return this.archivos.guardar(nombre, tipo, archivo.buffer);
  }

  // GET /archivos/:id/texto (lo usa el agente)
  @Get(':id/texto')
  texto(@Param('id', ParseIntPipe) id: number) {
    return this.archivos.texto(id);
  }
}
