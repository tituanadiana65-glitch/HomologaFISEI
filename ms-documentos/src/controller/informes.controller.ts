import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  HttpException,
  Param,
  ParseIntPipe,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { EventosService } from '../events/eventos.service';
import { conNombresDeCarrera, crearPdf, nombreEstudiante, type Carrera, type SolicitudInforme } from '../service/informe-pdf';

const MS_SOLICITUDES = process.env.MS_SOLICITUDES || 'http://localhost:3003';
const MS_CATALOGO = process.env.MS_CATALOGO || 'http://localhost:3002';

// Nombres de las carreras ("Software" en vez de "SW"); si el catálogo no responde, el informe usa los códigos
async function carreras(): Promise<Carrera[]> {
  try {
    const r = await fetch(`${MS_CATALOGO}/carreras`);
    return r.ok ? ((await r.json()) as Carrera[]) : [];
  } catch {
    return [];
  }
}

@Controller('informes')
export class InformesController {
  constructor(private readonly eventos: EventosService) {}

  @Get(':id')
  async descargar(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-usuario-id') usuario: string,
    @Headers('x-usuario-correo') correo: string,
    @Headers('x-usuario-nombre') nombre: string,
    @Headers('x-usuario-rol') rol: string,
    @Res() res: Response,
  ) {
    // El estudiante solo baja su informe (ms-solicitudes responde 403 si no es suyo); el docente que revisa baja cualquiera
    const docente = rol === 'DOCENTE';
    const r = await fetch(`${MS_SOLICITUDES}/solicitudes/${docente ? 'revision/' : ''}${id}`, {
      headers: { 'x-usuario-id': usuario ?? '', 'x-usuario-rol': rol ?? '' },
    });
    if (!r.ok)
      throw new HttpException(
        (await r.json()) as Record<string, unknown>,
        r.status,
      );

    const s = (await r.json()) as SolicitudInforme & { estado: string; estudiante?: string | null };
    if (!['RESULTADO_LISTO', 'REVISADA'].includes(s.estado))
      throw new BadRequestException('El resultado todavía no está listo');

    const estudiante = docente ? (s.estudiante ?? `Solicitud N.º ${id}`) : nombreEstudiante(nombre, correo);
    const pdf = await crearPdf(conNombresDeCarrera(s, await carreras()), estudiante);
    await this.eventos.publicar('informe.generado', { solicitudId: id });
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="informe-${id}.pdf"`,
      })
      .send(pdf);
  }
}
