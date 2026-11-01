import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReglasRepository } from './reglas.repository';
import { PrismaService } from './prisma.service';

function armar(regla: object | null) {
  const update = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
  const prisma = { regla: { findUnique: jest.fn().mockResolvedValue(regla), update } } as unknown as PrismaService;
  return { update, repo: new ReglasRepository(prisma) };
}

describe('ReglasRepository.cambiar', () => {
  const rn04 = { codigo: 'RN-04', valor: 7, activa: true, version: 1 };

  it('rechaza un valor 0', async () => {
    const { repo, update } = armar(rn04);
    await expect(repo.cambiar('RN-04', { valor: 0 })).rejects.toThrow(BadRequestException);
    expect(update).not.toHaveBeenCalled();
  });

  it('un valor válido se guarda y sube la versión', async () => {
    const { repo, update } = armar(rn04);
    await repo.cambiar('RN-04', { valor: 8 });
    expect(update).toHaveBeenCalledWith({ where: { codigo: 'RN-04' }, data: { valor: 8, activa: true, version: { increment: 1 } } });
  });

  it('una regla que no existe da 404', async () => {
    const { repo } = armar(null);
    await expect(repo.cambiar('RN-99', { valor: 1 })).rejects.toThrow(NotFoundException);
  });
});
