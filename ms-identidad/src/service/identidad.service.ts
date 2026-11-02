import { BadRequestException, Injectable, Logger, OnModuleInit, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../repository/prisma.service';
import { Registro, validarRegistro } from './validaciones';

const secreto = () => process.env.JWT_SECRETO ?? 'homologa-sprint2-secreto';

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

  async registrar(d: Registro) {
    const error = validarRegistro(d);
    if (error) throw new BadRequestException(error);
    const correo = d.correo.trim().toLowerCase();
    if (await this.prisma.usuario.findUnique({ where: { correo } })) throw new BadRequestException('Ese correo ya está registrado');
        let u;
    try {
      u = await this.prisma.usuario.create({ data: { nombre: d.nombre.trim(), correo, claveHash: await bcrypt.hash(d.clave, 10) } });
    } catch (e) {
      // dos registros a la vez con el mismo correo: la base de datos rechaza el segundo
      if ((e as { code?: string }).code === 'P2002') throw new BadRequestException('Ese correo ya está registrado');
      throw e;
    }
  }

  async entrar(d: { correo?: string; clave?: string }) {
    const u = await this.prisma.usuario.findUnique({ where: { correo: (d.correo ?? '').trim().toLowerCase() } });
    if (!u || !(await bcrypt.compare(d.clave ?? '', u.claveHash))) throw new UnauthorizedException('Correo o contraseña incorrectos');
    return this.sesion(u);
  }

  private sesion(u: { id: number; nombre: string; correo: string; rol: string }) {
    const usuario = { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol };
    return { token: jwt.sign({ sub: u.id, correo: u.correo, rol: u.rol }, secreto(), { expiresIn: '8h' }), usuario };
  }
}
