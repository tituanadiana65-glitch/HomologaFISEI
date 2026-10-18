// Carga de reglas para reglas_db (T09).
// Usa el modelo Regla que José crea en T10; hasta entonces este archivo no compila.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const reglas = [
  { codigo: 'RN-01', descripcion: 'Coincidencia de contenidos', valor: 0.8 },
  { codigo: 'RN-02', descripcion: 'Créditos mínimos', valor: 0.8 },
  { codigo: 'RN-03', descripcion: 'Horas mínimas', valor: 0.8 },
  { codigo: 'RN-04', descripcion: 'Nota mínima', valor: 7 },
  { codigo: 'RN-05', descripcion: 'Años máximos desde la aprobación', valor: 10 },
];

async function main() {
  await prisma.regla.deleteMany();
  await prisma.regla.createMany({
    data: reglas.map((r) => ({ ...r, carrera: 'TODAS' })),
  });
}

main().finally(() => prisma.$disconnect());
