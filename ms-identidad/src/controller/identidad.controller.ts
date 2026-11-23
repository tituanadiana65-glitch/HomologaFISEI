import { Body, Controller, Get, Post } from '@nestjs/common';
import { IdentidadService } from '../service/identidad.service';
import type { Registro } from '../service/validaciones';

@Controller()
export class IdentidadController {
  constructor(private readonly servicio: IdentidadService) {}

  @Post('registro')
  registrar(@Body() d: Registro) {
    return this.servicio.registrar(d);
  }

  // Solo el administrador (lo controla el api-gateway)
  @Post('docentes')
  crearDocente(@Body() d: Registro) {
    return this.servicio.crearDocente(d);
  }

  @Get('docentes')
  docentes() {
    return this.servicio.docentes();
  }

  @Post('login')
  entrar(@Body() d: { correo: string; clave: string }) {
    return this.servicio.entrar(d);
  }
}