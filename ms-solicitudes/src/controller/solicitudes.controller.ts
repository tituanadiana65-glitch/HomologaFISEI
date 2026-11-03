import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, UnauthorizedException } from '@nestjs/common';
import { SolicitudesService } from '../service/solicitudes.service';
import type { NuevaMateria, NuevaSolicitud } from '../service/validaciones';

// El API Gateway pone el usuario de la sesión en el encabezado x-usuario-id
export function usuario(id?: string): number {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new UnauthorizedException('Inicia sesión para continuar');
  return n;
}

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly servicio: SolicitudesService) {}

  // POST /solicitudes  { carreraOrigen, carreraDestino, periodo }
  @Post()
  crear(@Headers('x-usuario-id') u: string, @Body() d: NuevaSolicitud) {
    return this.servicio.crear(usuario(u), d);
  }

  // GET /solicitudes/mia
  @Get('mia')
  mia(@Headers('x-usuario-id') u: string) {
    return this.servicio.mia(usuario(u));
  }

  // GET /solicitudes/:id
  @Get(':id')
  ver(@Headers('x-usuario-id') u: string, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.ver(usuario(u), id);
  }

  // POST /solicitudes/:id/enviar
  @Post(':id/enviar')
  enviar(@Headers('x-usuario-id') u: string, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.enviar(usuario(u), id);
  }

  // POST /solicitudes/:id/materias  { codigo, nivel, paralelo, docente, periodo, anio, nota, matricula }
  @Post(':id/materias')
  agregar(@Headers('x-usuario-id') u: string, @Param('id', ParseIntPipe) id: number, @Body() m: NuevaMateria) {
    return this.servicio.agregarMateria(usuario(u), id, m);
  }

  // DELETE /solicitudes/:id/materias/:codigo
  @Delete(':id/materias/:codigo')
  quitar(@Headers('x-usuario-id') u: string, @Param('id', ParseIntPipe) id: number, @Param('codigo') codigo: string) {
    return this.servicio.quitarMateria(usuario(u), id, codigo);
  }

  // POST /solicitudes/:id/reintentar
  @Post(':id/reintentar')
  reintentar(@Headers('x-usuario-id') u: string, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.reintentar(usuario(u), id);
  }
}
