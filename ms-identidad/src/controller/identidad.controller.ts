import { Body, Controller, Get, Post } from '@nestjs/common';
import { IdentidadService } from '../service/identidad.service';
import type { Registro } from '../service/validaciones';

@Controller()
export class IdentidadController {
  constructor(private readonly servicio: IdentidadService) {}

  // Ya no hay registro de estudiantes (desde el 23/11/2026 el estudiante no usa el sistema):
  // las cuentas las crea el administrador en POST /personal

  // Solo el administrador (lo controla el api-gateway): crea coordinadores y docentes
  @Post('personal')
  crearPersonal(@Body() d: Registro & { rol?: string }) {
    return this.servicio.crearPersonal(d);
  }

  @Get('personal')
  personal() {
    return this.servicio.personal();
  }

  // Administrador y coordinador
  @Get('docentes')
  docentes() {
    return this.servicio.docentes();
  }

  @Post('login')
  entrar(@Body() d: { correo: string; clave: string }) {
    return this.servicio.entrar(d);
  }
}