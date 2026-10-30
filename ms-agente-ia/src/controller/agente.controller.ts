import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { HomologacionService } from '../service/homologacion.service';
import type { PedidoComparar, PedidoHomologar } from '../dto/tipos';

@Controller()
export class AgenteController {
  constructor(private readonly servicio: HomologacionService) {}

  // T11 · { codigoAprobada, codigoNueva } -> porcentaje de contenidos con explicación
  @Post('comparar')
  comparar(@Body() p: PedidoComparar) {
    return this.servicio.comparar(p);
  }

  // T12 · { codigoAprobada, codigoNueva, nota, anio } -> resultado e informe
  @Post('homologar')
  homologar(@Body() p: PedidoHomologar) {
    return this.servicio.homologar(p);
  }

  @Get('homologaciones')
  listar() {
    return this.servicio.listar();
  }

  @Get('homologaciones/:id')
  informe(@Param('id', ParseIntPipe) id: number) {
    return this.servicio.informe(id);
  }
}
