import { Body, Controller, Delete, Get, Headers, Param, ParseIntPipe, Post, Put, UnauthorizedException } from '@nestjs/common';
import { SolicitudesService } from '../service/solicitudes.service';
import type { NuevaMateria, NuevaMateriaExterna, NuevaSolicitud } from '../service/validaciones';

// El API Gateway pone el usuario de la sesión en el encabezado x-usuario-id
export function usuario(id?: string): number {
  const n = Number(id);
  if (!Number.isInteger(n) || n <= 0) throw new UnauthorizedException('Inicia sesión para continuar');
  return n;
}

// Quién hace el pedido: el docente asignado y el coordinador también trabajan con las solicitudes
export function quien(id?: string, rol?: string) {
  return { id: usuario(id), rol };
}

// El nombre llega codificado (puede tener tildes y ñ)
export function nombreDe(codificado?: string): string | undefined {
  if (!codificado) return undefined;
  try {
    return decodeURIComponent(codificado);
  } catch {
    return undefined;
  }
}

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly servicio: SolicitudesService) {}

  // POST /solicitudes  { carreraOrigen, carreraDestino, periodo }
  @Post()
  crear(@Headers('x-usuario-id') u: string, @Headers('x-usuario-nombre') nombre: string | undefined, @Body() d: NuevaSolicitud) {
    return this.servicio.crear(usuario(u), d, nombreDe(nombre));
  }

  // GET /solicitudes/mia
  @Get('mia')
  mia(@Headers('x-usuario-id') u: string) {
    return this.servicio.mia(usuario(u));
  }

  // GET /solicitudes/:id
  @Get(':id')
  ver(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.ver(quien(u, rol), id);
  }

  // POST /solicitudes/:id/enviar
  @Post(':id/enviar')
  enviar(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.enviar(quien(u, rol), id);
  }

  // POST /solicitudes/:id/materias  { codigo, nivel, paralelo, docente, periodo, anio, nota, matricula }
  @Post(':id/materias')
  agregar(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string, @Param('id', ParseIntPipe) id: number, @Body() m: NuevaMateria) {
    return this.servicio.agregarMateria(quien(u, rol), id, m);
  }

  // POST /solicitudes/:id/materias-externas  { nombre, creditos, horas, nota, escala, anio, silaboId }  (T38)
  @Post(':id/materias-externas')
  agregarExterna(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string, @Param('id', ParseIntPipe) id: number, @Body() m: NuevaMateriaExterna) {
    return this.servicio.agregarMateriaExterna(quien(u, rol), id, m);
  }

  // DELETE /solicitudes/:id/materias/:codigo
  @Delete(':id/materias/:codigo')
  quitar(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string, @Param('id', ParseIntPipe) id: number, @Param('codigo') codigo: string) {
    return this.servicio.quitarMateria(quien(u, rol), id, codigo);
  }

  // POST /solicitudes/:id/reintentar
  // PUT /solicitudes/:id/expediente  { mallaId?, recordId?, periodosAprobados?, documentosLegalizados? } (docente asignado)
  @Put(':id/expediente')
  expediente(
    @Headers('x-usuario-id') u: string,
    @Headers('x-usuario-rol') rol: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: { mallaId?: number; recordId?: number; periodosAprobados?: number; documentosLegalizados?: boolean },
  ) {
    return this.servicio.expediente(quien(u, rol), id, d);
  }

  @Post(':id/reintentar')
  reintentar(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.reintentar(quien(u, rol), id);
  }
}
