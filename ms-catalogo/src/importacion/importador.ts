// Importación de planes analíticos (observación del docente, 24/11/2026):
// además de subir los PDF uno por uno, se puede poner la URL o ruta donde están y el sistema los trae.
// Si un PDF no tiene el formato de la FISEI, la IA lo convierte a la matriz (materia, nivel, unidades, créditos).
import { BadRequestException } from '@nestjs/common';
import { readdir, readFile, stat } from 'fs/promises';
import { basename, join, resolve, sep } from 'path';
import type { PlanAnalitico } from '../dto/plan-analitico.dto';
import { carreraDesdeCodigo, leerPlan, textoPdf, validarPlan } from './lector-pdf';
import type { PlanesRepository } from '../repository/planes.repository';
import type { EventosService } from '../events/eventos.service';

export const MAX_ARCHIVOS = 80;
const MAX_BYTES = 10 * 1024 * 1024;
const CARPETA_PLANES = process.env.PLANES_DIR || '/planes'; // carpeta "planes" del proyecto montada en el contenedor
const MS_AGENTE = process.env.MS_AGENTE || 'http://localhost:3005';

export interface Archivo {
  nombre: string;
  obtener: () => Promise<Buffer>;
}

export interface ResultadoImportacion {
  archivo: string;
  ok: boolean;
  codigo?: string;
  nombre?: string;
  carrera?: string;
  conIA?: boolean;
  error?: string;
}

type Buscar = (url: string, init?: RequestInit) => Promise<Response>;
const esPdf = (nombre: string) => nombre.toLowerCase().split('?')[0].endsWith('.pdf');
const slug = (t: string) =>
  t.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

export class Importador {
  constructor(
    private readonly repo: PlanesRepository,
    private readonly eventos: EventosService,
    private readonly buscar: Buscar = (u, i) => fetch(u, i),
    private readonly carpeta = CARPETA_PLANES,
  ) {}

  // Un PDF: con el lector de la FISEI y, si no tiene ese formato y se indicó la carrera, con IA
  async importarBuffer(nombre: string, buffer: Buffer, carrera?: string) {
    if (!esPdf(nombre)) throw new BadRequestException(`${nombre} no es un PDF`);
    let plan: PlanAnalitico;
    try {
      plan = await leerPlan(buffer);
    } catch {
      throw new BadRequestException(`${nombre} no se pudo leer como PDF`);
    }
    let conIA = false;
    const faltan = validarPlan(plan);
    if (faltan.length) {
      if (!carrera) {
        throw new BadRequestException(
          `${nombre} no parece un plan analítico de la FISEI (falta ${faltan.join(', ')}). Indica la carrera para leerlo con inteligencia artificial.`,
        );
      }
      plan = await this.leerConIA(nombre, await textoPdf(buffer), carrera);
      conIA = true;
    }
    const codigoCarrera = (carrera || carreraDesdeCodigo(plan.codigo) || '').toUpperCase();
    if (!codigoCarrera) throw new BadRequestException('Indica la carrera, por ejemplo ?carrera=TI');
    const guardado = await this.repo.guardar(plan, codigoCarrera);
    await this.eventos.publicar('plan.importado', guardado);
    return { ...guardado, creditos: plan.creditos, horasTotales: plan.horasTotales, conIA };
  }

  // La IA (ms-agente-ia) convierte el texto del plan en una fila de la matriz
  private async leerConIA(nombre: string, texto: string, carrera: string): Promise<PlanAnalitico> {
    if (!texto.trim()) throw new BadRequestException(`${nombre} no tiene texto que se pueda leer (¿es un escaneo?)`);
    const r = await this.buscar(`${MS_AGENTE}/leer-plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    }).catch(() => null);
    if (!r?.ok) throw new BadRequestException(`${nombre}: la inteligencia artificial no pudo leer el plan; intenta de nuevo`);
    const p = (await r.json()) as Partial<PlanAnalitico>;
    const plan: PlanAnalitico = {
      codigo: p.codigo || `${carrera.toUpperCase()}-${slug(p.nombre || basename(nombre, '.pdf'))}`,
      nombre: (p.nombre || basename(nombre, '.pdf')).toUpperCase(),
      carrera: p.carrera || carrera.toUpperCase(),
      nivel: p.nivel || '',
      periodo: p.periodo || '',
      docente: p.docente || '',
      unidadOrganizacional: p.unidadOrganizacional || '',
      creditos: Number(p.creditos) || 0,
      horasTotales: Number(p.horasTotales) || 0,
      prerrequisitos: [],
      correquisitos: [],
      objetivoGeneral: p.objetivoGeneral || '',
      unidades: (p.unidades ?? []).map((u, i) => ({ numero: i + 1, horas: Number(u.horas) || 0, contenido: String(u.contenido ?? '') })),
    };
    const faltan = validarPlan(plan);
    if (faltan.length) throw new BadRequestException(`${nombre}: la inteligencia artificial no encontró ${faltan.join(', ')}`);
    return plan;
  }

  // Varios planes desde una URL (un PDF, una carpeta de GitHub o una página con enlaces a PDF) o una carpeta del servidor
  async importarRuta(ruta: string, carrera?: string): Promise<{ total: number; importados: number; resultados: ResultadoImportacion[] }> {
    const archivos = await this.resolver((ruta ?? '').trim());
    if (!archivos.length) throw new BadRequestException('No se encontraron PDF en esa ruta');
    const resultados: ResultadoImportacion[] = [];
    for (const a of archivos.slice(0, MAX_ARCHIVOS)) {
      try {
        const r = await this.importarBuffer(a.nombre, await a.obtener(), carrera || undefined);
        resultados.push({ archivo: a.nombre, ok: true, codigo: r.codigo, nombre: r.nombre, carrera: r.carrera, conIA: r.conIA });
      } catch (e) {
        resultados.push({ archivo: a.nombre, ok: false, error: (e as Error).message });
      }
    }
    return { total: archivos.length, importados: resultados.filter((r) => r.ok).length, resultados };
  }

  async resolver(ruta: string): Promise<Archivo[]> {
    if (!ruta) throw new BadRequestException('Escribe la URL o la ruta de los planes analíticos');
    if (/^https?:\/\//i.test(ruta)) return this.resolverUrl(ruta);
    return this.resolverCarpeta(ruta);
  }

  // Carpeta del servidor: solo dentro de la carpeta de planes (por ejemplo "SW" o "planes/TI")
  private async resolverCarpeta(ruta: string): Promise<Archivo[]> {
    const base = resolve(this.carpeta);
    const destino = resolve(base, ruta.replace(/^\/?planes\/?/i, '').replace(/^\/+/, ''));
    if (destino !== base && !destino.startsWith(base + sep)) throw new BadRequestException('Esa ruta está fuera de la carpeta de planes');
    const info = await stat(destino).catch(() => null);
    if (!info) throw new BadRequestException(`No existe la ruta ${ruta} en la carpeta de planes`);
    const nombres = info.isDirectory() ? (await readdir(destino)).filter(esPdf).sort().map((n) => join(destino, n)) : esPdf(destino) ? [destino] : [];
    return nombres.map((n) => ({ nombre: basename(n), obtener: () => readFile(n) }));
  }

  private async resolverUrl(url: string): Promise<Archivo[]> {
    const gh = url.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/(tree|blob)\/([^/]+)\/?(.*)$/i);
    if (gh) {
      const [, dueno, repo, tipo, rama, camino] = gh;
      if (tipo === 'blob') return [this.descargable(`https://raw.githubusercontent.com/${dueno}/${repo}/${rama}/${camino}`)];
      const r = await this.buscar(`https://api.github.com/repos/${dueno}/${repo}/contents/${camino}?ref=${encodeURIComponent(rama)}`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'HomologaFISEI' },
      }).catch(() => null);
      if (!r?.ok) throw new BadRequestException('No se pudo abrir esa carpeta de GitHub (¿es pública?)');
      const lista = (await r.json()) as { type: string; name: string; download_url: string | null }[];
      return lista.filter((x) => x.type === 'file' && esPdf(x.name) && x.download_url).map((x) => this.descargable(x.download_url!, x.name));
    }
    if (esPdf(url)) return [this.descargable(url)];
    // Página con enlaces (por ejemplo, un listado de archivos): se toman los enlaces a PDF
    const r = await this.buscar(url).catch(() => null);
    if (!r?.ok) throw new BadRequestException(`No se pudo abrir ${url}`);
    if ((r.headers.get('content-type') ?? '').includes('pdf')) {
      const buffer = Buffer.from(await r.arrayBuffer());
      return [{ nombre: `${basename(new URL(url).pathname) || 'plan'}.pdf`, obtener: () => Promise.resolve(buffer) }];
    }
    const html = await r.text();
    const enlaces = [...html.matchAll(/href\s*=\s*["']([^"']+?\.pdf(?:\?[^"']*)?)["']/gi)].map((m) => new URL(m[1], url).toString());
    return [...new Set(enlaces)].map((e) => this.descargable(e));
  }

  private descargable(url: string, nombre?: string): Archivo {
    return {
      nombre: nombre ?? decodeURIComponent(basename(new URL(url).pathname)),
      obtener: async () => {
        const r = await this.buscar(url).catch(() => null);
        if (!r?.ok) throw new BadRequestException(`No se pudo descargar ${url}`);
        const buffer = Buffer.from(await r.arrayBuffer());
        if (buffer.length > MAX_BYTES) throw new BadRequestException('El PDF pesa más de 10 MB');
        return buffer;
      },
    };
  }
}
