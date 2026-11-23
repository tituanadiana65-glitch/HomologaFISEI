import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { personaDe, resultadoFinal, RevisionService } from './revision.service';
import { PrismaService } from '../repository/prisma.service';

// Coordinador y docente: el coordinador asigna el docente y el docente hace la homologación
function armar(solicitud: object | null) {
  const prisma = {
    solicitud: {
      findUnique: jest.fn().mockResolvedValue(solicitud),
      findMany: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({}),
    },
    asignaturaAprobada: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  return { prisma, s: new RevisionService(prisma as unknown as PrismaService) };
}

const coord = { id: 5, nombre: 'Ing. Coordinadora' };
const ana = { id: 10, nombre: 'Ing. Ana' };
const luis = { id: 11, nombre: 'Ing. Luis' };
const lista = (extra: object = {}) => ({
  id: 3,
  tipo: 'INTERNO',
  estado: 'RESULTADO_LISTO',
  docenteId: 10,
  materias: [
    { codigo: 'A', resultado: 'Homologable', juntoCon: 'B' },
    { codigo: 'B', resultado: 'Homologable', juntoCon: 'A' },
    { codigo: 'C', resultado: 'No homologable', juntoCon: null },
  ],
  ...extra,
});

describe('RevisionService · coordinador', () => {
  it('lista las solicitudes con resultado del agente', async () => {
    const { s, prisma } = armar(null);
    await s.listarCoordinacion();
    expect(prisma.solicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { estado: { in: ['RESULTADO_LISTO', 'REVISADA'] } } }));
  });

  it('asigna (o cambia) el docente y guarda quién lo asignó', async () => {
    const { s, prisma } = armar(lista({ docenteId: null }));
    await expect(s.asignar(coord, 3, { docenteId: 11, docente: ' Ing. Luis ' })).resolves.toEqual({ id: 3, docenteId: 11, docente: 'Ing. Luis' });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { docenteId: 11, docente: 'Ing. Luis', coordinador: 'Ing. Coordinadora', asignada: expect.any(Date) },
    });
  });

  it('pide el docente, no asigna sin resultado ni cuando ya está terminada', async () => {
    await expect(armar(lista()).s.asignar(coord, 3, {})).rejects.toThrow('Elige el docente');
    await expect(armar(lista({ estado: 'ENVIADA' })).s.asignar(coord, 3, { docenteId: 11, docente: 'L' })).rejects.toThrow('todavía no tiene');
    await expect(armar(lista({ estado: 'REVISADA' })).s.asignar(coord, 3, { docenteId: 11, docente: 'L' })).rejects.toThrow('ya terminó');
  });
});

describe('RevisionService · docente', () => {
  it('ve solo sus solicitudes', async () => {
    const { s, prisma } = armar(null);
    await s.listarDelDocente(ana);
    expect(prisma.solicitud.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { docenteId: 10, estado: { in: ['RESULTADO_LISTO', 'REVISADA'] } } }));
    await expect(armar(lista()).s.verDelDocente(luis, 3)).rejects.toThrow(ForbiddenException);
  });

  it('cambia el resultado con comentario y se aplica a las materias evaluadas juntas', async () => {
    const { s, prisma } = armar(lista());
    await s.cambiar(ana, 3, 'A', { resultado: 'No homologable', comentario: 'Los temas de laboratorio no coinciden' });
    expect(prisma.asignaturaAprobada.updateMany).toHaveBeenCalledWith({
      where: { solicitudId: 3, codigo: { in: ['A', 'B'] } },
      data: { resultadoDocente: 'No homologable', comentarioDocente: 'Los temas de laboratorio no coinciden', docenteCambio: 'Ing. Ana' },
    });
  });

  it('si vuelve al resultado del agente se quita el cambio', async () => {
    const { s, prisma } = armar(lista());
    await s.cambiar(ana, 3, 'C', { resultado: 'No homologable', comentario: 'Queda como dijo el agente' });
    expect(prisma.asignaturaAprobada.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { resultadoDocente: null, comentarioDocente: null, docenteCambio: null } }),
    );
  });

  it('pide un resultado válido, un comentario y una materia de la solicitud; otro docente no puede cambiar', async () => {
    const { s } = armar(lista());
    await expect(s.cambiar(ana, 3, 'C', { resultado: 'Tal vez', comentario: 'xxxxxx' })).rejects.toThrow('El resultado debe ser');
    await expect(s.cambiar(ana, 3, 'C', { resultado: 'Homologable', comentario: ' ' })).rejects.toThrow('comentario');
    await expect(s.cambiar(ana, 3, 'Z', { resultado: 'Homologable', comentario: 'xxxxxx' })).rejects.toThrow('no está');
    await expect(s.cambiar(luis, 3, 'C', { resultado: 'Homologable', comentario: 'xxxxxx' })).rejects.toThrow('no está asignada a ti');
  });

  it('otra universidad: RN-08 se vuelve a revisar con el resultado del docente', async () => {
    const { s, prisma } = armar(lista({ tipo: 'EXTERNO', periodosAprobados: 2, documentosLegalizados: true }));
    await s.cambiar(ana, 3, 'C', { resultado: 'Homologable', comentario: 'Revisé el sílabo: sí cumple' });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { requisitos: expect.stringContaining('"cumple"') } });
  });

  it('termina la homologación: queda REVISADA con su comentario y ya no se cambia', async () => {
    const { s, prisma } = armar(lista());
    await expect(s.terminar(ana, 3, { comentario: ' Listo ' })).resolves.toEqual({ id: 3, estado: 'REVISADA' });
    expect(prisma.solicitud.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { estado: 'REVISADA', terminada: expect.any(Date), comentarioFinal: 'Listo' } });
    const terminada = armar(lista({ estado: 'REVISADA' }));
    await expect(terminada.s.terminar(ana, 3, {})).rejects.toThrow(BadRequestException);
    await expect(terminada.s.cambiar(ana, 3, 'C', { resultado: 'Homologable', comentario: 'xxxxxx' })).rejects.toThrow('Ya terminaste');
  });

  it('no termina con materias pendientes', async () => {
    await expect(armar(lista({ materias: [{ codigo: 'A', resultado: 'Pendiente' }] })).s.terminar(ana, 3, {})).rejects.toThrow('pendientes');
  });

  it('resultado final y permisos', () => {
    expect(resultadoFinal({ resultado: 'Homologable', resultadoDocente: 'No homologable' })).toBe('No homologable');
    expect(resultadoFinal({ resultado: 'Homologable' })).toBe('Homologable');
    expect(personaDe('DOCENTE', '10', 'DOCENTE', 'Ing. Ana')).toEqual({ id: 10, nombre: 'Ing. Ana' });
    expect(() => personaDe('COORDINADOR', '10', 'DOCENTE')).toThrow(ForbiddenException);
  });
});
