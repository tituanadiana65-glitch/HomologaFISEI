import { BadRequestException, Body, Controller, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Importador } from '../importacion/importador';
import { PlanesRepository } from '../repository/planes.repository';
import { EventosService } from '../events/eventos.service';

@Controller('planes')
export class PlanesController {
  private readonly importador: Importador;

  constructor(
    private readonly repo: PlanesRepository,
    private readonly eventos: EventosService,
  ) {
    this.importador = new Importador(repo, eventos);
  }

  // POST /planes/importar?carrera=TI  (campo del formulario: "archivo")
  @Post('importar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importar(@UploadedFile() archivo: Express.Multer.File, @Query('carrera') carrera?: string) {
    if (!archivo) throw new BadRequestException('Falta el archivo PDF (campo "archivo")');
    return this.importador.importarBuffer(archivo.originalname, archivo.buffer, carrera);
  }

  // POST /planes/importar-ruta  { ruta, carrera? }: URL de un PDF, carpeta de GitHub, página con enlaces o carpeta del servidor
  @Post('importar-ruta')
  importarRuta(@Body() d: { ruta?: string; carrera?: string }) {
    return this.importador.importarRuta(d?.ruta ?? '', d?.carrera);
  }
}
