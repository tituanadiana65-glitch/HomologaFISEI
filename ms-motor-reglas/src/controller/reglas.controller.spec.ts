import { BadRequestException } from '@nestjs/common';
import { ReglasController } from './reglas.controller';
import { ReglasService } from '../service/reglas.service';
import { ReglasRepository } from '../repository/reglas.repository';

const cambiar = jest.fn().mockResolvedValue({ codigo: 'RN-04', valor: 8, version: 2 });
const repo = {
  config: jest.fn().mockResolvedValue({ creditosMinimo: 0.8, horasMinimo: 0.8, notaMinima: 7, maxAnios: 10 }),
  listar: jest.fn(),
  cambiar,
} as unknown as ReglasRepository;

describe('ReglasController', () => {
  const c = new ReglasController(new ReglasService(), repo);

  it('evalúa con los valores de reglas_db', async () => {
    const r = await c.evaluar({ origen: { creditos: 2, horas: 96 }, destino: { creditos: 3, horas: 144 } });
    expect(r.homologable).toBe(false);
  });

  it('rechaza datos incompletos', async () => {
    await expect(c.evaluar({ origen: { creditos: 0, horas: 96 }, destino: { creditos: 3, horas: 144 } })).rejects.toThrow(BadRequestException);
  });

  it('PUT /reglas/:codigo delega en el repositorio', async () => {
    const r = await c.cambiar('RN-04', { valor: 8 });
    expect(cambiar).toHaveBeenCalledWith('RN-04', { valor: 8 });
    expect(r.version).toBe(2);
  });
});
