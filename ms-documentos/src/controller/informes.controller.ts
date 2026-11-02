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
import { crearPdf, type SolicitudInforme } from '../service/informe-pdf';

const MS_SOLICITUDES = process.env.MS_SOLICITUDES || 'http://localhost:3003';

@Controller('informes')
export class InformesController {
  constructor(private readonly eventos: EventosService) {}

  @Get(':id')
  async descargar(
    @Param('id', ParseIntPipe) id: number,
    @Headers('x-usuario-id') usuario: string,
    @Headers('x-usuario-correo') correo: string,
    @Res() res: Response,
  ) {
    // ms-solicitudes revisa que la solicitud sea de este usuario: 403 si no es suya, 404 si no existe
    const r = await fetch(`${MS_SOLICITUDES}/solicitudes/${id}`, {
      headers: { 'x-usuario-id': usuario ?? '' },
    });
    if (!r.ok)
      throw new HttpException(
        (await r.json()) as Record<string, unknown>,
        r.status,
      );

    const s = (await r.json()) as SolicitudInforme & { estado: string };
    if (s.estado !== 'RESULTADO_LISTO')
      throw new BadRequestException('El resultado todavía no está listo');

    const pdf = await crearPdf(s, correo ?? '');
    await this.eventos.publicar('informe.generado', { solicitudId: id });
    res
      .set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="informe-${id}.pdf"`,
      })
      .send(pdf);
  }
}
