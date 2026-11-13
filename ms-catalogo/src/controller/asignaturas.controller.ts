import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { PlanesRepository } from '../repository/planes.repository';

@Controller()
export class AsignaturasController {
  constructor(private readonly repo: PlanesRepository) {}

  // GET /asignaturas?carrera=SW&buscar=calculo&nivel=PRIMERO
  @Get('asignaturas')
  listar(@Query('carrera') carrera?: string, @Query('buscar') buscar?: string, @Query('nivel') nivel?: string) {
    return this.repo.listar(carrera?.toUpperCase(), buscar, nivel?.toUpperCase());
  }

  // GET /niveles?carrera=TI
  @Get('niveles')
  niveles(@Query('carrera') carrera = 'TI') {
    return this.repo.niveles(carrera.toUpperCase());
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

  // T51 · POST /carreras { codigo, nombre }  (el api-gateway solo deja pasar al administrador)
  @Post('carreras')
  async crearCarrera(@Body() body: { codigo?: string; nombre?: string }) {
    const codigo = (body?.codigo ?? '').trim().toUpperCase();
    const nombre = (body?.nombre ?? '').trim();
    if (!/^[A-Z]{2,10}$/.test(codigo)) throw new BadRequestException('El código debe tener de 2 a 10 letras, por ejemplo RO');
    if (nombre.length < 3) throw new BadRequestException('Escribe el nombre de la carrera');
    const creada = await this.repo.crearCarrera(codigo, nombre);
    if (!creada) throw new ConflictException(`La carrera ${codigo} ya existe`);
    return creada;
  }
}
