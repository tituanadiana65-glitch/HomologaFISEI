import { Body, Controller, Post } from '@nestjs/common';
import { IdentidadService } from '../service/identidad.service';
import type { Registro } from '../service/validaciones';

@Controller()
export class IdentidadController {
  constructor(private readonly servicio: IdentidadService) {}

  @Post('registro')
  registrar(@Body() d: Registro) {
    return this.servicio.registrar(d);
  }

  @Post('login')
  entrar(@Body() d: { correo: string; clave: string }) {
    return this.servicio.entrar(d);
  }
}