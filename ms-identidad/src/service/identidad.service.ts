import { BadRequestException, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../repository/prisma.service';
import { Registro, validarRegistro } from './validaciones';

const secreto = () => process.env.JWT_SECRETO ?? 'homologa-sprint2-secreto';

export const ROLES_PERSONAL = ['COORDINADOR', 'DOCENTE'];

@Injectable()
export class IdentidadService implements OnModuleInit {
  private readonly log = new Logger(IdentidadService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Crea el administrador la primera vez
  async onModuleInit() {
    const correo = process.env.ADMIN_CORREO;
    if (!correo || (await this.prisma.usuario.findUnique({ where: { correo } }))) return;
    await this.prisma.usuario.create({
      data: { nombre: 'Administrador', correo, rol: 'ADMIN', claveHash: await bcrypt.hash(process.env.ADMIN_CLAVE ?? 'Admin2026*', 10) },
    });
    this.log.log(`Administrador creado: ${correo}`);
  }

  // El administrador crea las cuentas del personal: COORDINADOR (asigna docentes) y DOCENTE (hace la homologación)
  async crearPersonal(d: Registro & { rol?: string }) {
    const rol = d?.rol ?? 'DOCENTE';
    if (!ROLES_PERSONAL.includes(rol)) throw new BadRequestException('El rol debe ser COORDINADOR o DOCENTE');
    const error = validarRegistro(d);
    if (error) throw new BadRequestException(error.replace('tu nombre', 'el nombre').replace('Usa tu correo', 'Usa el correo'));
    const correo = d.correo.trim().toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { correo } })) throw new BadRequestException('Ese correo ya está registrado');
    const u = await this.prisma.usuario.create({ data: { nombre: d.nombre.trim(), correo, rol, claveHash: await bcrypt.hash(d.clave, 10) } });
    return { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol };
  }

  personal() {
    return this.prisma.usuario.findMany({
      where: { rol: { in: ROLES_PERSONAL } },
      select: { id: true, nombre: true, correo: true, rol: true },
      orderBy: [{ rol: 'asc' }, { nombre: 'asc' }],
    });
  }

  // Para que el coordinador elija a quién asignar
  docentes() {
    return this.prisma.usuario.findMany({ where: { rol: 'DOCENTE' }, select: { id: true, nombre: true, correo: true }, orderBy: { nombre: 'asc' } });
  }

  async entrar(d: { correo?: string; clave?: string }) {
    const u = await this.prisma.usuario.findUnique({ where: { correo: (d.correo ?? '').trim().toLowerCase() } });
    if (!u || !(await bcrypt.compare(d.clave ?? '', u.claveHash))) throw new UnauthorizedException('Correo o contraseña incorrectos');
    // Las cuentas de estudiante del flujo anterior ya no entran: el estudiante entrega sus papeles al coordinador
    if (u.rol === 'ESTUDIANTE') throw new UnauthorizedException('Los estudiantes ya no usan el sistema: entrega tu solicitud en la coordinación de la carrera');
    return this.sesion(u);
  }

  private sesion(u: { id: number; nombre: string; correo: string; rol: string }) {
    const usuario = { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol };
    return { token: jwt.sign({ sub: u.id, correo: u.correo, nombre: u.nombre, rol: u.rol }, secreto(), { expiresIn: '8h' }), usuario };
  }
}
