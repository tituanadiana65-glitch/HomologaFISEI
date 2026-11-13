import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AgenteService } from './agente.service';
import { ClientesService } from './clientes.service';
import { armarInforme } from './informe';
import { PrismaService } from '../repository/prisma.service';
import { EventosService } from '../events/eventos.service';
import type { Informe, MateriaCatalogo, PedidoComparar, PedidoExterno, PedidoHomologar } from '../dto/tipos';

@Injectable()
export class HomologacionService {
  constructor(
    private readonly agente: AgenteService,
    private readonly clientes: ClientesService,
    private readonly prisma: PrismaService,
    private readonly eventos: EventosService,
  ) {}

  private validar(p: PedidoComparar) {
    if (!p?.codigoAprobada || !p?.codigoNueva) {
      throw new BadRequestException('Envía codigoAprobada y codigoNueva');
    }
  }

  // T11 · Solo contenidos (RN-01)
  async comparar(p: PedidoComparar) {
    this.validar(p);
    const [aprobada, nueva, minimo] = await Promise.all([
      this.clientes.materia(p.codigoAprobada),
      this.clientes.materia(p.codigoNueva),
      this.clientes.minimoContenidos(),
    ]);
    return this.agente.comparar(aprobada, nueva, minimo);
  }

  // T44 · Solo contenidos (RN-01): sílabo de otra universidad frente al plan analítico de una materia de la FISEI
  async compararSilabo(p: { silabo: string; codigoNueva: string }) {
    if (!p?.silabo?.trim() || !p?.codigoNueva) throw new BadRequestException('Envía silabo y codigoNueva');
    const [nueva, minimo] = await Promise.all([this.clientes.materia(p.codigoNueva), this.clientes.minimoContenidos()]);
    return this.agente.compararConSilabo(p.silabo, nueva, minimo);
  }

  // T12 · Resultado completo: contenidos + reglas, con informe guardado
  async homologar(p: PedidoHomologar): Promise<Informe> {
    this.validar(p);
    const [aprobada, nueva, minimo] = await Promise.all([
      this.clientes.materia(p.codigoAprobada),
      this.clientes.materia(p.codigoNueva),
      this.clientes.minimoContenidos(),
    ]);
    const [contenidos, reglas] = await Promise.all([
      this.agente.comparar(aprobada, nueva, minimo),
      this.clientes.evaluar(
        { creditos: aprobada.creditos, horas: aprobada.horasTotales, nota: p.nota, anio: p.anio },
        { creditos: nueva.creditos, horas: nueva.horasTotales },
      ),
    ]);
    return this.guardar(p, armarInforme(aprobada, nueva, contenidos, reglas, minimo));
  }

  // T46 · Materia de otra universidad: contenidos del sílabo (RN-01) + reglas con los datos que escribió el estudiante
  async homologarExterna(p: PedidoExterno): Promise<Informe> {
    if (!p?.codigoAprobada || !p?.codigoNueva || !p?.silabo?.trim()) throw new BadRequestException('Envía codigoAprobada, codigoNueva y silabo');
    if (!(p.creditos > 0) || !(p.horas > 0)) throw new BadRequestException(`La materia ${p.codigoAprobada} necesita créditos y horas mayores a 0`);
    const [nueva, minimo] = await Promise.all([this.clientes.materia(p.codigoNueva), this.clientes.minimoContenidos()]);
    // La "aprobada" no está en el catálogo: sus datos son los del mensaje
    const aprobada: MateriaCatalogo = { codigo: p.codigoAprobada, nombre: p.nombre, creditos: p.creditos, horasTotales: p.horas, unidades: [] };
    const [contenidos, reglas] = await Promise.all([
      this.agente.compararConSilabo(p.silabo, nueva, minimo),
      this.clientes.evaluar(
        { creditos: p.creditos, horas: p.horas, nota: p.nota, anio: p.anio },
        { creditos: nueva.creditos, horas: nueva.horasTotales },
      ),
    ]);
    const externo = { parecido: p.parecido, notaOriginal: p.notaOriginal, escala: p.escala, nota: p.nota };
    return this.guardar(p, armarInforme(aprobada, nueva, contenidos, reglas, minimo, externo));
  }

  // Guarda el informe, publica el evento y devuelve el informe con su id y fecha
  private async guardar(p: { codigoAprobada: string; codigoNueva: string; nota?: number; anio?: number }, informe: Informe): Promise<Informe> {
    const guardado = await this.prisma.homologacion.create({
      data: {
        codigoAprobada: p.codigoAprobada,
        codigoNueva: p.codigoNueva,
        nota: p.nota ?? null,
        anio: p.anio ?? null,
        resultado: informe.resultado,
        porcentaje: informe.porcentaje,
        informe: JSON.stringify(informe),
      },
    });
    const final = { ...informe, id: guardado.id, fecha: guardado.fecha.toISOString() };
    await this.eventos.publicar('homologacion.completada', { id: final.id, resultado: final.resultado, aprobada: final.aprobada, nueva: final.nueva });
    return final;
  }

  async listar() {
    const filas = await this.prisma.homologacion.findMany({ orderBy: { fecha: 'desc' }, take: 50 });
    return filas.map((f) => ({ id: f.id, codigoAprobada: f.codigoAprobada, codigoNueva: f.codigoNueva, resultado: f.resultado, porcentaje: f.porcentaje, fecha: f.fecha }));
  }

  async informe(id: number): Promise<Informe> {
    const f = await this.prisma.homologacion.findUnique({ where: { id } });
    if (!f) throw new NotFoundException(`No existe la homologación ${id}`);
    return { ...(JSON.parse(f.informe) as Informe), id: f.id, fecha: f.fecha.toISOString() };
  }
}
