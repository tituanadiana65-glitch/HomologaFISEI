import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { PlanesRepository } from '../repository/planes.repository';

@Controller()
export class AsignaturasController {
  constructor(private readonly repo: PlanesRepository) {}

  // GET /asignaturas?carrera=SW&buscar=calculo
  @Get('asignaturas')
  listar(@Query('carrera') carrera?: string, @Query('buscar') buscar?: string) {
    return this.repo.listar(carrera?.toUpperCase(), buscar);
  }

  // GET /asignaturas/UTA-FISEI-TI-MP-UB-02-01  (con unidades y requisitos)
  @Get('asignaturas/:codigo')
  async buscar(@Param('codigo') codigo: string) {
    const a = await this.repo.buscar(codigo);
    if (!a) throw new NotFoundException(`No existe la asignatura ${codigo}`);
    return a;
  }

  @Get('carreras')
  carreras() {
    return this.repo.carreras();
  }
}
