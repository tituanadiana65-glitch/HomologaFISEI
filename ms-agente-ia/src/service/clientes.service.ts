import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import type { MateriaCatalogo, ResultadoReglas } from '../dto/tipos';

// Llamadas HTTP a los otros microservicios (direcciones desde docker-compose.yml).
@Injectable()
export class ClientesService {
  private readonly catalogo = process.env.MS_CATALOGO || 'http://localhost:3002';
  private readonly reglas = process.env.MS_REGLAS || 'http://localhost:3004';

  async materia(codigo: string): Promise<MateriaCatalogo> {
    const r = await fetch(`${this.catalogo}/asignaturas/${encodeURIComponent(codigo)}`).catch(() => null);
    if (!r) throw new BadGatewayException('ms-catalogo no responde');
    if (r.status === 404) throw new NotFoundException(`No existe la asignatura ${codigo}. Importa primero su plan analítico.`);
    if (!r.ok) throw new BadGatewayException(`ms-catalogo respondió ${r.status}`);
    return (await r.json()) as MateriaCatalogo;
  }

  async evaluar(origen: object, destino: object): Promise<ResultadoReglas> {
    const r = await fetch(`${this.reglas}/evaluar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origen, destino }),
    }).catch(() => null);
    if (!r || !r.ok) throw new BadGatewayException('ms-motor-reglas no responde');
    return (await r.json()) as ResultadoReglas;
  }

  // Porcentaje mínimo de contenidos (RN-01) configurado en reglas_db
  async minimoContenidos(): Promise<number> {
    try {
      const r = await fetch(`${this.reglas}/reglas`);
      const reglas = (await r.json()) as { codigo: string; valor: number; activa: boolean }[];
      const rn01 = reglas.find((x) => x.codigo === 'RN-01' && x.activa);
      return rn01 ? Math.round(rn01.valor * 100) : 80;
    } catch {
      return 80;
    }
  }
}
