import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../repository/prisma.service';
import { validarRegistro, type Registro } from './validaciones';

const TOKEN_SECRET = 'homologa-sprint2-secreto';

@Injectable()
export class IdentidadService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(d: Registro) {
    const error = validarRegistro(d);
    if (error) throw new BadRequestException(error);

    const correo = d.correo.trim().toLowerCase();
    const existente = await this.prisma.usuario.findUnique({ where: { correo } });
    if (existente) throw new BadRequestException('El correo ya está registrado');

    const usuario = await this.prisma.usuario.create({
      data: {
        nombre: d.nombre.trim(),
        correo,
        claveHash: await bcrypt.hash(d.clave, 10),
      },
    });

    return { token: this.crearToken(usuario.id, usuario.rol) };
  }

  async entrar(d: { correo: string; clave: string }) {
    const correo = d.correo.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({ where: { correo } });
    if (!usuario || !(await bcrypt.compare(d.clave, usuario.claveHash))) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    return { token: this.crearToken(usuario.id, usuario.rol) };
  }

  private crearToken(id: number, rol: string): string {
    return jwt.sign({ sub: id, rol }, TOKEN_SECRET, { expiresIn: '8h' });
  }
}
