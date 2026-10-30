// Carga de reglas para reglas_db (T09, Diana).
// El servicio también las crea solo al arrancar si la tabla está vacía.
import { PrismaClient } from '@prisma/client';
import { REGLAS_INICIALES } from '../src/repository/reglas-iniciales';

const prisma = new PrismaClient();

async function main() {
  for (const r of REGLAS_INICIALES) {
    await prisma.regla.upsert({
      where: { codigo: r.codigo },
      update: { descripcion: r.descripcion, valor: r.valor },
      create: { ...r, carrera: 'TODAS' },
    });
  }
}

main().finally(() => prisma.$disconnect());
