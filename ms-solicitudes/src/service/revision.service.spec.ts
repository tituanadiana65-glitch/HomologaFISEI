import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { docenteDe, resultadoFinal, RevisionService } from './revision.service';
import { PrismaService } from '../repository/prisma.service';

// Revisión docente: dos docentes revisan el mismo informe
function armar(solicitud: object | null) {
  const prisma = {
    solicitud: {
      findUnique: jest.fn().mockResolvedValue(solicitud),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    asignaturaAprobada: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    revision: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  return { prisma, s: new RevisionService(prisma as unknown as PrismaService) };
}

const ana = { id: 10, nombre: 'Ing. Ana' };
const luis = { id: 11, nombre: 'Ing. Luis' };
const lista = (extra: object = {}) => ({
  id: 3,
  tipo: 'INTERNO',
  estado: 'RESULTADO_LISTO',
  revisiones: [],
  materias: [
    { codigo: 'A', resultado: 'Homologable', juntoCon: 'B' },
    { codigo: 'B', resultado: 'Homologable', juntoCon: 'A' },
    { codigo: 'C', resultado: 'No homologable', juntoCon: null },
  ],
  ...extra,
});

describe('RevisionService', () => {
  it('lista los informes con resultado del agente', async () => {
    const { s, prisma } = armar(null);
    await s.listar();
    expect(prisma.solicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { estado: { in: ['RESULTADO_LISTO', 'REVISADA'] } } }));
  });

  it('no deja revisar una solicitud sin resultado', async () => {
    await expect(armar(lista({ estado: 'ENVIADA' })).s.ver(3)).rejects.toThrow('todavía no tiene');
  });

  it('el docente cambia el resultado con comentario; se aplica al grupo y se borran las aprobaciones', async () => {
    const { s, prisma } = armar(lista());
    const r = await s.cambiar(ana, 3, 'A', { resultado: 'No homologable', comentario: 'Los temas de laboratorio no coinciden' });
    expect(prisma.asignaturaAprobada.updateMany).toHaveBeenCalledWith({
      where: { solicitudId: 3, codigo: { in: ['A', 'B'] } },
      data: { resultadoDocente: 'No homologable', comentarioDocente: 'Los temas de laboratorio no coinciden', docenteCambio: 'Ing. Ana' },
    });
    expect(prisma.revision.deleteMany).toHaveBeenCalledWith({ where: { solicitudId: 3 } });
    expect(r.aprobacionesBorradas).toBe(1);
  });

  it('si vuelve al resultado del agente se quita el cambio', async () => {
    const { s, prisma } = armar(lista());
    await s.cambiar(ana, 3, 'C', { resultado: 'No homologable', comentario: 'Queda como dijo el agente' });
    expect(prisma.asignaturaAprobada.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { resultadoDocente: null, comentarioDocente: null, docenteCambio: null } }),
    );
  });

  it('pide un resultado válido y un comentario', async () => {
    const { s } = armar(lista());
    await expect(s.cambiar(ana, 3, 'C', { resultado: 'Tal vez', comentario: 'xxxxxx' })).rejects.toThrow('El resultado debe ser');
    await expect(s.cambiar(ana, 3, 'C', { resultado: 'Homologable', comentario: ' ' })).rejects.toThrow('comentario');
    await expect(s.cambiar(ana, 3, 'Z', { resultado: 'Homologable', comentario: 'xxxxxx' })).rejects.toThrow('no está');
  });

  it('otra universidad: RN-08 se vuelve a revisar con el resultado del docente', async () => {
    const { s, prisma } = armar(lista({ tipo: 'EXTERNO', periodosAprobados: 2, documentosLegalizados: true }));
    await s.cambiar(ana, 3, 'C', { resultado: 'Homologable', comentario: 'Revisé el sílabo: sí cumple' });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { requisitos: expect.stringContaining('"cumple"') } });
  });

  it('con la primera aprobación falta un docente; con la segunda queda REVISADA', async () => {
    const primera = armar(lista());
    await expect(primera.s.aprobar(ana, 3, { comentario: 'De acuerdo' })).resolves.toEqual({ id: 3, aprobaciones: 1, revisada: false });
    expect(primera.prisma.revision.create).toHaveBeenCalledWith({ data: { solicitudId: 3, docenteId: 10, docente: 'Ing. Ana', comentario: 'De acuerdo' } });
    expect(primera.prisma.solicitud.update).not.toHaveBeenCalled();

    const segunda = armar(lista({ revisiones: [{ docenteId: 10, docente: 'Ing. Ana' }] }));
    await expect(segunda.s.aprobar(luis, 3, {})).resolves.toEqual({ id: 3, aprobaciones: 2, revisada: true });
    expect(segunda.prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { estado: 'REVISADA' } });
  });

  it('el mismo docente no aprueba dos veces, y no se aprueba con pendientes ni ya revisado', async () => {
    await expect(armar(lista({ revisiones: [{ docenteId: 10 }] })).s.aprobar(ana, 3, {})).rejects.toThrow('Ya aprobaste');
    await expect(armar(lista({ materias: [{ codigo: 'A', resultado: 'Pendiente' }] })).s.aprobar(ana, 3, {})).rejects.toThrow('pendientes');
    await expect(armar(lista({ estado: 'REVISADA' })).s.aprobar(ana, 3, {})).rejects.toThrow(BadRequestException);
  });

  it('resultado final y quién es docente', () => {
    expect(resultadoFinal({ resultado: 'Homologable', resultadoDocente: 'No homologable' })).toBe('No homologable');
    expect(resultadoFinal({ resultado: 'Homologable' })).toBe('Homologable');
    expect(docenteDe('10', 'DOCENTE', 'Ing. Ana')).toEqual({ id: 10, nombre: 'Ing. Ana' });
    expect(() => docenteDe('5', 'ESTUDIANTE')).toThrow(ForbiddenException);
  });
});
