import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventosService } from '../events/eventos.service';
import { ClientesService } from './clientes.service';
import { HomologacionService } from './homologacion.service';
import { buscarEquivalente } from './equivalencia';
import type { Informe, Resultado } from '../dto/tipos';

interface SolicitudEnviada {
  solicitudId: number;
  carreraDestino: string;
  materias: { codigo: string; nota: number; anio: number }[];
}

interface ResultadoMateria {
  codigoAprobada: string;
  codigoNueva: string | null;
  resultado: Resultado;
  informe: Informe | null;
}

// Pausa entre materias por el límite de consultas por minuto de Gemini (en las pruebas: IA_PAUSA_MS=0)
const pausa = () => Number(process.env.IA_PAUSA_MS ?? 4000);
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class SolicitudesAgenteService implements OnModuleInit {
  private readonly log = new Logger(SolicitudesAgenteService.name);

  constructor(
    private readonly eventos: EventosService,
    private readonly clientes: ClientesService,
    private readonly homologacion: HomologacionService,
  ) {}

  onModuleInit() {
    void this.eventos.escuchar('ms-agente-ia.solicitudes', 'solicitud.enviada', (d) => this.homologarSolicitud(d));
  }

  async homologarSolicitud(d: SolicitudEnviada) {
    const destino = await this.clientes.asignaturas(d.carreraDestino);
    const resultados: ResultadoMateria[] = [];
    for (const m of d.materias) {
      try {
        const aprobada = await this.clientes.materia(m.codigo);
        const nueva = buscarEquivalente(aprobada.nombre, destino);
        if (!nueva) {
          resultados.push({ codigoAprobada: m.codigo, codigoNueva: null, resultado: 'Sin materia equivalente', informe: null });
          continue;
        }
        const informe = await this.homologacion.homologar({ codigoAprobada: m.codigo, codigoNueva: nueva.codigo, nota: m.nota, anio: m.anio });
        resultados.push({ codigoAprobada: m.codigo, codigoNueva: nueva.codigo, resultado: informe.resultado, informe });
        await esperar(pausa());
      } catch (e) {
        // una materia con problema no detiene a las demás
        this.log.warn(`Solicitud ${d.solicitudId}, materia ${m.codigo}: ${(e as Error).message}`);
        resultados.push({ codigoAprobada: m.codigo, codigoNueva: null, resultado: 'Pendiente', informe: null });
      }
    }
    await this.eventos.publicar('solicitud.homologada', { solicitudId: d.solicitudId, resultados });
    this.log.log(`Solicitud ${d.solicitudId}: ${resultados.length} materias homologadas`);
  }
}
