import { Body, Controller, Get, Headers, Param, ParseIntPipe, Post, Put } from '@nestjs/common';
import { personaDe, RevisionService } from '../service/revision.service';
import { SolicitudesService } from '../service/solicitudes.service';
import type { NuevaSolicitud } from '../service/validaciones';
import { nombreDe } from './solicitudes.controller';

// Estos controladores van antes que SolicitudesController en el módulo para que
// /solicitudes/coordinacion y /solicitudes/revision no se lean como un id.

// Coordinador: registra las solicitudes que entregan los estudiantes, asigna el docente y recibe el resultado
@Controller('solicitudes/coordinacion')
export class CoordinacionController {
  constructor(
    private readonly servicio: RevisionService,
    private readonly solicitudes: SolicitudesService,
  ) {}

  // POST /solicitudes/coordinacion  { estudiante, tipo, carreraOrigen, carreraDestino, periodo, universidadOrigen?, periodosAprobados?, documentosLegalizados?, docenteId?, docente? }
  @Post()
  crear(
    @Headers('x-usuario-id') u: string,
    @Headers('x-usuario-rol') rol: string,
    @Headers('x-usuario-nombre') nombre: string,
    @Headers('x-usuario-correo') correo: string,
    @Body() d: NuevaSolicitud & { estudiante?: string; documento?: string; tipoDocumento?: string; docenteId?: number; docente?: string },
  ) {
    return this.solicitudes.crearPorCoordinador(personaDe('COORDINADOR', u, rol, nombreDe(nombre), correo), d);
  }

  @Get()
  listar(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string) {
    personaDe('COORDINADOR', u, rol);
    return this.servicio.listarCoordinacion();
  }

  @Get(':id')
  ver(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string, @Param('id', ParseIntPipe) id: number) {
    personaDe('COORDINADOR', u, rol);
    return this.servicio.verCoordinacion(id);
  }

  // PUT /solicitudes/coordinacion/:id/docente  { docenteId, docente }
  @Put(':id/docente')
  asignar(
    @Headers('x-usuario-id') u: string,
    @Headers('x-usuario-rol') rol: string,
    @Headers('x-usuario-nombre') nombre: string,
    @Headers('x-usuario-correo') correo: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: { docenteId?: number; docente?: string },
  ) {
    return this.servicio.asignar(personaDe('COORDINADOR', u, rol, nombreDe(nombre), correo), id, d);
  }
}

// Docente: solo las solicitudes que le asignaron
@Controller('solicitudes/revision')
export class RevisionController {
  constructor(private readonly servicio: RevisionService) {}

  @Get()
  listar(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string) {
    return this.servicio.listarDelDocente(personaDe('DOCENTE', u, rol));
  }

  @Get(':id')
  ver(@Headers('x-usuario-id') u: string, @Headers('x-usuario-rol') rol: string, @Param('id', ParseIntPipe) id: number) {
    return this.servicio.verDelDocente(personaDe('DOCENTE', u, rol), id);
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
    @Body() d: { resultado?: string; comentario?: string; codigoNueva?: string; nombreNueva?: string; confirmo?: boolean },
  ) {
    return this.servicio.cambiar(personaDe('DOCENTE', u, rol, nombreDe(nombre), correo), id, codigo, d);
  }

  // POST /solicitudes/revision/:id/terminar  { comentario? }
  @Post(':id/terminar')
  terminar(
    @Headers('x-usuario-id') u: string,
    @Headers('x-usuario-rol') rol: string,
    @Headers('x-usuario-nombre') nombre: string,
    @Headers('x-usuario-correo') correo: string,
    @Param('id', ParseIntPipe) id: number,
    @Body() d: { comentario?: string },
  ) {
    return this.servicio.terminar(personaDe('DOCENTE', u, rol, nombreDe(nombre), correo), id, d);
  }
}
