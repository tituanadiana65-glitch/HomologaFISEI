import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  for (const c of [
    { codigo: 'TI', nombre: 'Tecnologías de la Información' },
    { codigo: 'SW', nombre: 'Software' },
  ]) {
    await prisma.carrera.upsert({
      where: { codigo: c.codigo },
      update: {},
      create: c,
    });
  }
}

main().finally(() => prisma.$disconnect());
