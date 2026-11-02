import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
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

  // T35 · El administrador cambia el valor o activa/desactiva una regla; cada cambio sube la versión
    async cambiar(codigo: string, d: { valor?: number; activa?: boolean }) {
    if (!d || (d.valor === undefined && d.activa === undefined)) throw new BadRequestException('Envía "valor" o "activa"');
    if (d.activa !== undefined && typeof d.activa !== 'boolean') throw new BadRequestException('"activa" debe ser true o false');
    const r = await this.prisma.regla.findUnique({ where: { codigo } });
    if (!r) throw new NotFoundException(`No existe la regla ${codigo}`);
    if (d.valor !== undefined) {
      if (typeof d.valor !== 'number' || !(d.valor > 0)) throw new BadRequestException('El valor debe ser mayor a 0');
      if (['RN-01', 'RN-02', 'RN-03'].includes(codigo) && d.valor > 1) {
        throw new BadRequestException('Este valor es un porcentaje entre 0 y 1 (0.8 = 80 %)');
      }
      if (codigo === 'RN-04' && d.valor > 10) throw new BadRequestException('La nota máxima es 10');
    }
    return this.prisma.regla.update({
      where: { codigo },
      data: { valor: d.valor ?? r.valor, activa: d.activa ?? r.activa, version: { increment: 1 } },
    });
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
