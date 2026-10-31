import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controller/health.controller';
import { SolicitudesController } from './controller/solicitudes.controller';
import { PrismaService } from './repository/prisma.service';
import { EventosService } from './events/eventos.service';
import { SolicitudesService } from './service/solicitudes.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, SolicitudesController],
  providers: [PrismaService, EventosService, SolicitudesService],
})
export class AppModule {}
