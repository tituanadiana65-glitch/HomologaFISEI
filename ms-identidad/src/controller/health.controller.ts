import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { ok: true, servicio: process.env.SERVICIO ?? 'ms-plantilla' };
  }
}