import { BadGatewayException, Injectable, NotFoundException } from '@nestjs/common';
import type { MateriaCatalogo, MateriaTexto, ResultadoReglas } from '../dto/tipos';

// Llamadas HTTP a los otros microservicios (direcciones desde docker-compose.yml).
@Injectable()
export class ClientesService {
  private readonly catalogo = process.env.MS_CATALOGO || 'http://localhost:3002';
  private readonly reglas = process.env.MS_REGLAS || 'http://localhost:3004';
  private readonly documentos = process.env.MS_DOCUMENTOS || 'http://localhost:3006';

  async materia(codigo: string): Promise<MateriaCatalogo> {
    const r = await fetch(`${this.catalogo}/asignaturas/${encodeURIComponent(codigo)}`).catch(() => null);
    if (!r) throw new BadGatewayException('ms-catalogo no responde');
    if (r.status === 404) throw new NotFoundException(`No existe la asignatura ${codigo}. Importa primero su plan analítico.`);
    if (!r.ok) throw new BadGatewayException(`ms-catalogo respondió ${r.status}`);
    return (await r.json()) as MateriaCatalogo;
  }

  // Asignaturas de una carrera (T27: para buscar la materia equivalente)
  async asignaturas(carrera: string): Promise<{ codigo: string; nombre: string }[]> {
    const r = await fetch(`${this.catalogo}/asignaturas?carrera=${encodeURIComponent(carrera)}`).catch(() => null);
    if (!r || !r.ok) throw new BadGatewayException('ms-catalogo no responde');
    return (await r.json()) as { codigo: string; nombre: string }[];
  }

  // T43 · Materias de una carrera con sus unidades (para elegir la más parecida a un sílabo)
  async candidatas(carrera: string): Promise<MateriaTexto[]> {
    const lista = await this.asignaturas(carrera);
    return Promise.all(lista.map((a) => this.materia(a.codigo)));
  }

  // T43 · Texto del sílabo guardado en ms-documentos (ruta acordada con Paola, T39)
  async textoSilabo(id: number): Promise<string> {
    const r = await fetch(`${this.documentos}/documentos/archivos/${id}/texto`).catch(() => null);
    if (!r) throw new BadGatewayException('ms-documentos no responde');
    if (r.status === 404) throw new NotFoundException(`No existe el sílabo ${id}`);
    if (!r.ok) throw new BadGatewayException(`ms-documentos respondió ${r.status}`);
    return ((await r.json()) as { texto: string }).texto;
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
