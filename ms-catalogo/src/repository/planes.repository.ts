import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import type { PlanAnalitico } from '../dto/plan-analitico.dto';

// Carreras con las que arranca el piloto. Otras carreras de la FISEI se crean solas al importar su plan.
export const CARRERAS_INICIALES = [
  { codigo: 'TI', nombre: 'Tecnologías de la Información' },
  { codigo: 'SW', nombre: 'Software' },
];

@Injectable()
export class PlanesRepository implements OnModuleInit {
  private readonly log = new Logger(PlanesRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    for (const c of CARRERAS_INICIALES) {
      await this.prisma.carrera.upsert({ where: { codigo: c.codigo }, update: {}, create: c });
    }
    this.log.log('Carreras TI y SW listas');
  }

  // Guarda el plan por su código: si ya existía, lo actualiza (no duplica).
  async guardar(plan: PlanAnalitico, codigoCarrera: string) {
    const carrera = await this.prisma.carrera.upsert({
      where: { codigo: codigoCarrera },
      update: {},
      create: { codigo: codigoCarrera, nombre: plan.carrera || codigoCarrera },
    });
    const datos = {
      nombre: plan.nombre,
      nivel: plan.nivel,
      creditos: plan.creditos,
      horasTotales: plan.horasTotales,
      unidadOrganizacional: plan.unidadOrganizacional,
      periodo: plan.periodo,
      docente: plan.docente,
      objetivoGeneral: plan.objetivoGeneral,
      carreraId: carrera.id,
    };
    return this.prisma.$transaction(async (tx) => {
      const a = await tx.asignatura.upsert({
        where: { codigo: plan.codigo },
        update: datos,
        create: { codigo: plan.codigo, ...datos },
      });
      await tx.unidad.deleteMany({ where: { asignaturaId: a.id } });
      await tx.requisito.deleteMany({ where: { asignaturaId: a.id } });
      await tx.unidad.createMany({ data: plan.unidades.map((u) => ({ ...u, asignaturaId: a.id })) });
      const requisitos = [
        ...plan.prerrequisitos.map((r) => ({ ...r, tipo: 'PRE', asignaturaId: a.id })),
        ...plan.correquisitos.map((r) => ({ ...r, tipo: 'CO', asignaturaId: a.id })),
      ];
      if (requisitos.length) await tx.requisito.createMany({ data: requisitos });
      return { codigo: a.codigo, nombre: a.nombre, carrera: codigoCarrera, unidades: plan.unidades.length };
    });
  }

  buscar(codigo: string) {
    return this.prisma.asignatura.findUnique({
      where: { codigo },
      include: { carrera: true, requisitos: true, unidades: { orderBy: { numero: 'asc' } } },
    });
  }

  listar(codigoCarrera?: string, texto?: string) {
    return this.prisma.asignatura.findMany({
      where: {
        ...(codigoCarrera ? { carrera: { codigo: codigoCarrera } } : {}),
        ...(texto ? { nombre: { contains: texto } } : {}),
      },
      select: {
        codigo: true,
        nombre: true,
        nivel: true,
        creditos: true,
        horasTotales: true,
        docente: true,
        carrera: { select: { codigo: true, nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    });
  }

  carreras() {
    return this.prisma.carrera.findMany({
      orderBy: { codigo: 'asc' },
      include: { _count: { select: { asignaturas: true } } },
    });
  }
}
