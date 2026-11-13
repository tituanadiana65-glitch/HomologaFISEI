import { BadRequestException, ConflictException } from '@nestjs/common';
import { AsignaturasController } from './asignaturas.controller';
import type { PlanesRepository } from '../repository/planes.repository';

describe('AsignaturasController · crear carrera (T51)', () => {
  const repo = { crearCarrera: jest.fn() };
  const c = new AsignaturasController(repo as unknown as PlanesRepository);
  beforeEach(() => repo.crearCarrera.mockReset());

  it('crea la carrera con el código en mayúsculas', async () => {
    repo.crearCarrera.mockResolvedValue({ id: 3, codigo: 'RO', nombre: 'Robótica' });
    const r = await c.crearCarrera({ codigo: ' ro ', nombre: ' Robótica ' });
    expect(repo.crearCarrera).toHaveBeenCalledWith('RO', 'Robótica');
    expect(r.codigo).toBe('RO');
  });

  it('rechaza un código inválido', async () => {
    await expect(c.crearCarrera({ codigo: 'R', nombre: 'Robótica' })).rejects.toThrow(BadRequestException);
    await expect(c.crearCarrera({ codigo: 'R-1', nombre: 'Robótica' })).rejects.toThrow(BadRequestException);
    await expect(c.crearCarrera({ nombre: 'Robótica' })).rejects.toThrow(BadRequestException);
  });

  it('rechaza un nombre vacío', async () => {
    await expect(c.crearCarrera({ codigo: 'RO', nombre: '  ' })).rejects.toThrow(BadRequestException);
  });

  it('si el código ya existe responde conflicto', async () => {
    repo.crearCarrera.mockResolvedValue(null);
    await expect(c.crearCarrera({ codigo: 'TI', nombre: 'Otra' })).rejects.toThrow(ConflictException);
  });
});
