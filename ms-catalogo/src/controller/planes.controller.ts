import { BadRequestException, Controller, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { carreraDesdeCodigo, leerPlan, validarPlan } from '../importacion/lector-pdf';
import { PlanesRepository } from '../repository/planes.repository';
import { EventosService } from '../events/eventos.service';

@Controller('planes')
export class PlanesController {
  constructor(
    private readonly repo: PlanesRepository,
    private readonly eventos: EventosService,
  ) {}

  // POST /planes/importar?carrera=TI  (campo del formulario: "archivo")
  @Post('importar')
  @UseInterceptors(FileInterceptor('archivo', { limits: { fileSize: 10 * 1024 * 1024 } }))
  async importar(@UploadedFile() archivo: Express.Multer.File, @Query('carrera') carrera?: string) {
    if (!archivo) throw new BadRequestException('Falta el archivo PDF (campo "archivo")');
    if (!archivo.originalname.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException(`${archivo.originalname} no es un PDF`);
    }
    let plan;
    try {
      plan = await leerPlan(archivo.buffer);
    } catch {
      throw new BadRequestException(`${archivo.originalname} no se pudo leer como PDF`);
    }
    const faltan = validarPlan(plan);
    if (faltan.length) {
      throw new BadRequestException(`${archivo.originalname} no parece un plan analítico de la FISEI: falta ${faltan.join(', ')}`);
    }
    const codigoCarrera = (carrera || carreraDesdeCodigo(plan.codigo) || '').toUpperCase();
    if (!codigoCarrera) throw new BadRequestException('Indica la carrera, por ejemplo ?carrera=TI');
    const guardado = await this.repo.guardar(plan, codigoCarrera);
    await this.eventos.publicar('plan.importado', guardado);
    return { ...guardado, creditos: plan.creditos, horasTotales: plan.horasTotales };
  }
}
