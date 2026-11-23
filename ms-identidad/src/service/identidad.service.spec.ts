import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { IdentidadService } from './identidad.service';
import { PrismaService } from '../repository/prisma.service';

function armar(existente: object | null = null) {
  const usuario = {
    findUnique: jest.fn().mockResolvedValue(existente),
    create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1, rol: 'ESTUDIANTE', ...data })),
    findMany: jest.fn().mockResolvedValue([]),
  };
  return { usuario, s: new IdentidadService({ usuario } as unknown as PrismaService) };
}

describe('IdentidadService', () => {
  it('registra con la contraseña cifrada y devuelve un token de 8 horas', async () => {
    const { s, usuario } = armar();
    const r = await s.registrar({ nombre: 'Ana', correo: 'Ana@uta.edu.ec', clave: 'Clave2026*' });
    const guardado = usuario.create.mock.calls[0][0].data;
    expect(guardado.claveHash).not.toBe('Clave2026*');
    expect(guardado.correo).toBe('ana@uta.edu.ec');
    const datos = jwt.verify(r.token, 'homologa-sprint2-secreto') as jwt.JwtPayload;
    expect(datos.rol).toBe('ESTUDIANTE');
    expect(datos.exp! - datos.iat!).toBe(8 * 3600);
  });

  it('devuelve el usuario (sin la contraseña) y el token lleva el correo', async () => {
    const { s } = armar();
    const r = await s.registrar({ nombre: 'Ana', correo: 'ana@uta.edu.ec', clave: 'Clave2026*' });
    expect(r.usuario).toEqual({ id: 1, nombre: 'Ana', correo: 'ana@uta.edu.ec', rol: 'ESTUDIANTE' });
    expect((jwt.verify(r.token, 'homologa-sprint2-secreto') as jwt.JwtPayload).correo).toBe('ana@uta.edu.ec');
    expect((jwt.verify(r.token, 'homologa-sprint2-secreto') as jwt.JwtPayload).nombre).toBe('Ana'); // para el informe PDF
  });

  it('rechaza un correo repetido', async () => {
    const { s } = armar({ id: 9 });
    await expect(s.registrar({ nombre: 'Ana', correo: 'ana@uta.edu.ec', clave: 'Clave2026*' })).rejects.toThrow(BadRequestException);
  });

  it('login correcto y login con clave equivocada', async () => {
    const claveHash = await bcrypt.hash('Clave2026*', 4);
    const { s } = armar({ id: 1, nombre: 'Ana', correo: 'ana@uta.edu.ec', rol: 'ESTUDIANTE', claveHash });
    expect((await s.entrar({ correo: 'ana@uta.edu.ec', clave: 'Clave2026*' })).token).toBeTruthy();
    await expect(s.entrar({ correo: 'ana@uta.edu.ec', clave: 'otra' })).rejects.toThrow(UnauthorizedException);
  });

  describe('administrador inicial', () => {
    beforeEach(() => {
      process.env.ADMIN_CORREO = 'admin@uta.edu.ec';
      process.env.ADMIN_CLAVE = 'Admin2026*';
    });
    afterEach(() => {
      delete process.env.ADMIN_CORREO;
      delete process.env.ADMIN_CLAVE;
    });

    it('se crea al arrancar si no existe, con rol ADMIN y la clave cifrada', async () => {
      const { s, usuario } = armar(null);
      await s.onModuleInit();
      const data = usuario.create.mock.calls[0][0].data;
      expect(data).toEqual(expect.objectContaining({ correo: 'admin@uta.edu.ec', rol: 'ADMIN' }));
      expect(await bcrypt.compare('Admin2026*', data.claveHash)).toBe(true);
    });

    it('no se vuelve a crear si ya existe', async () => {
      const { s, usuario } = armar({ id: 1 });
      await s.onModuleInit();
      expect(usuario.create).not.toHaveBeenCalled();
    });
  });
});

// Revisión docente: el administrador crea las cuentas de los docentes
describe('IdentidadService · docentes', () => {
  it('crea un docente con rol DOCENTE y la clave cifrada, sin devolver la clave', async () => {
    const { s, usuario } = armar();
    const r = await s.crearDocente({ nombre: 'Ing. Pérez', correo: 'JPerez@uta.edu.ec', clave: 'Docente2026*' });
    const guardado = usuario.create.mock.calls[0][0].data;
    expect(guardado).toEqual(expect.objectContaining({ rol: 'DOCENTE', correo: 'jperez@uta.edu.ec' }));
    expect(guardado.claveHash).not.toBe('Docente2026*');
    expect(r).toEqual({ id: 1, nombre: 'Ing. Pérez', correo: 'jperez@uta.edu.ec', rol: 'DOCENTE' });
  });

  it('valida los datos y no repite correos', async () => {
    await expect(armar().s.crearDocente({ nombre: '', correo: 'a@uta.edu.ec', clave: 'Docente2026*' })).rejects.toThrow('el nombre del docente');
    await expect(armar({ id: 3 }).s.crearDocente({ nombre: 'A', correo: 'a@uta.edu.ec', clave: 'Docente2026*' })).rejects.toThrow('ya está registrado');
  });

  it('lista solo los docentes', async () => {
    const { s, usuario } = armar();
    await s.docentes();
    expect(usuario.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { rol: 'DOCENTE' } }));
  });
});
