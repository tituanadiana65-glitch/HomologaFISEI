import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ConfigReglas } from '../dto/evaluar.dto';
import { REGLAS_INICIALES } from './reglas-iniciales';

@Injectable()
export class ReglasRepository implements OnModuleInit {
  private readonly log = new Logger(ReglasRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  // Si reglas_db está vacía, carga los valores de docs/reglas.md
  async onModuleInit() {
    const total = await this.prisma.regla.count();
    if (total === 0) {
      await this.prisma.regla.createMany({ data: REGLAS_INICIALES.map((r) => ({ ...r, carrera: 'TODAS' })) });
      this.log.log(`Reglas iniciales cargadas: ${REGLAS_INICIALES.length}`);
    }
  }

  listar() {
    return this.prisma.regla.findMany({ orderBy: { codigo: 'asc' } });
  }

  async config(): Promise<ConfigReglas> {
    const reglas = await this.prisma.regla.findMany({ where: { activa: true } });
    const valor = (codigo: string, defecto: number) => reglas.find((r) => r.codigo === codigo)?.valor ?? defecto;
    return {
      creditosMinimo: valor('RN-02', 0.8),
      horasMinimo: valor('RN-03', 0.8),
      notaMinima: valor('RN-04', 7),
      maxAnios: valor('RN-05', 10),
    };
  }
}
