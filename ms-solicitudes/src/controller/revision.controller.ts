import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { docenteDe, RevisionService } from '../service/revision.service';
import { nombreDe } from './solicitudes.controller';

// Revisión docente. Va antes que SolicitudesController en el módulo para que /solicitudes/revision no se lea como un id.
@Controller('solicitudes/revision')
export class RevisionController {
  constructor(private readonly servicio: RevisionService) {}

  @Get()
  listar(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string) {
    docenteDe(u, rol);
    return this.servicio.listar();
  }

  @Get(':id')
  ver(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string, @Param('id', ParseIntPipe) id: number) {
    docenteDe(u, rol);
    return this.servicio.ver(id);
  }

  // PUT /solicitudes/revision/:id/materias/:codigo  { resultado, comentario }
  @Put(':id/materias/:codigo')
  cambiar(
    @Headers('x-usuario-id') u: string,
    @Headers('x-usuario-rol') rol: string,
    @Headers('x-usuario-nombre') nombre: string,
    @Headers('x-usuario-correo') correo: string,
    @Param('id', ParseIntPipe) id: number,
    @Param('codigo') codigo: string,
    @Body() d: { resultado?: string; comentario?: string },
  ) {
    return this.servicio.cambiar(docenteDe(u, rol, nombreDe(nombre), correo), id, codigo, d);
  }

  // POST /solicitudes/revision/:id/aprobar  { comentario? }
  @Post(':id/aprobar')
  aprobar(
    @Headers('x-usuario-id') u: string,
    @Headers('x-usuario-rol') rol: string,
    @Headers('x-usuario-nombre') nombre: string,
    @Headers('x-usuario-correo') correo: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: { comentario?: string },
  ) {
    return this.servicio.aprobar(docenteDe(u, rol, nombreDe(nombre), correo), id, d);
  }
}
