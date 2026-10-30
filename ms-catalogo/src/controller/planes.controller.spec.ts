import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException } from '@nestjs/common';
import { PlanesController } from './planes.controller';
import { PlanesRepository } from '../repository/planes.repository';
import { EventosService } from '../events/eventos.service';

const archivo = (nombre: string, buffer: Buffer) => ({ originalname: nombre, buffer }) as Express.Multer.File;

describe('PlanesController', () => {
  const repo = { guardar: jest.fn().mockImplementation((p: { codigo: string; nombre: string }, c: string) => Promise.resolve({ codigo: p.codigo, nombre: p.nombre, carrera: c, unidades: 4 })) };
  const eventos = { publicar: jest.fn().mockResolvedValue(true) };
  const c = new PlanesController(repo as unknown as PlanesRepository, eventos as unknown as EventosService);

  it('importa un plan real y deduce la carrera SW por el código SF', async () => {
    const pdf = readFileSync(join(__dirname, '../../test/fixtures/calculo-integral-sw.pdf'));
    const r = await c.importar(archivo('calculo.pdf', pdf));
    expect(r.carrera).toBe('SW');
    expect(r.creditos).toBe(3);
    expect(eventos.publicar).toHaveBeenCalledWith('plan.importado', expect.objectContaining({ carrera: 'SW' }));
  });

  it('rechaza un archivo que no es PDF', async () => {
    await expect(c.importar(archivo('notas.txt', Buffer.from('hola')))).rejects.toThrow(BadRequestException);
  });

  it('rechaza un PDF que no es un plan analítico', async () => {
    await expect(c.importar(archivo('otro.pdf', Buffer.from('%PDF-1.4 basura')))).rejects.toThrow(BadRequestException);
  });
});
