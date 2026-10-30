import { PlanesRepository } from './planes.repository';
import { PrismaService } from './prisma.service';
import type { PlanAnalitico } from '../dto/plan-analitico.dto';

const plan: PlanAnalitico = {
  codigo: 'UTA-FISEI-TI-MP-UB-02-01', nombre: 'CALCULO INTEGRAL', carrera: 'Tecnologías de la Información',
  nivel: 'SEGUNDO', periodo: 'JULIO 2026 - DICIEMBRE 2026', docente: 'DOCENTE', unidadOrganizacional: 'BÁSICA',
  creditos: 2, horasTotales: 96, objetivoGeneral: '...', correquisitos: [],
  prerrequisitos: [{ codigo: 'UTA-FISEI-TI-MP-UB-01-03', nombre: 'CALCULO DIFERENCIAL' }],
  unidades: [{ numero: 1, horas: 24, contenido: 'Integración' }],
};

function prismaFalso() {
  const tx = {
    asignatura: { upsert: jest.fn().mockResolvedValue({ id: 7, codigo: plan.codigo, nombre: plan.nombre }) },
    unidad: { deleteMany: jest.fn(), createMany: jest.fn() },
    requisito: { deleteMany: jest.fn(), createMany: jest.fn() },
  };
  const prisma = {
    carrera: { upsert: jest.fn().mockResolvedValue({ id: 1, codigo: 'TI' }) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  return { prisma: prisma as unknown as PrismaService, tx, carrera: prisma.carrera };
}

describe('PlanesRepository', () => {
  it('guarda por código para no duplicar', async () => {
    const { prisma, tx } = prismaFalso();
    const r = await new PlanesRepository(prisma).guardar(plan, 'TI');
    expect(tx.asignatura.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { codigo: plan.codigo } }));
    expect(tx.unidad.deleteMany).toHaveBeenCalled();
    expect(r).toEqual({ codigo: plan.codigo, nombre: plan.nombre, carrera: 'TI', unidades: 1 });
  });

  it('guarda prerrequisitos como PRE', async () => {
    const { prisma, tx } = prismaFalso();
    await new PlanesRepository(prisma).guardar(plan, 'TI');
    expect(tx.requisito.createMany).toHaveBeenCalledWith({
      data: [{ codigo: 'UTA-FISEI-TI-MP-UB-01-03', nombre: 'CALCULO DIFERENCIAL', tipo: 'PRE', asignaturaId: 7 }],
    });
  });

  it('crea la carrera si es nueva (sirve para cualquier carrera de la FISEI)', async () => {
    const { prisma, carrera } = prismaFalso();
    await new PlanesRepository(prisma).guardar({ ...plan, carrera: 'Telecomunicaciones' }, 'TC');
    expect(carrera.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: { codigo: 'TC', nombre: 'Telecomunicaciones' } }));
  });
});
