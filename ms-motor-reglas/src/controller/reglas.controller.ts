import { BadRequestException, Body, Controller, Get, Post } from '@nestjs/common';
import { ReglasService } from '../service/reglas.service';
import { ReglasRepository } from '../repository/reglas.repository';
import type { EvaluarDto, MateriaReglas } from '../dto/evaluar.dto';

function validar(m: MateriaReglas | undefined, nombre: string) {
  if (!m || !(m.creditos > 0) || !(m.horas > 0)) {
    throw new BadRequestException(`${nombre} necesita créditos y horas mayores a 0`);
  }
}

@Controller()
export class ReglasController {
  constructor(
    private readonly reglas: ReglasService,
    private readonly repo: ReglasRepository,
  ) {}

  @Post('evaluar')
  async evaluar(@Body() body: EvaluarDto) {
    validar(body?.origen, 'origen');
    validar(body?.destino, 'destino');
    return this.reglas.evaluar(body.origen, body.destino, await this.repo.config());
  }

  @Get('reglas')
  listar() {
    return this.repo.listar();
  }
}
