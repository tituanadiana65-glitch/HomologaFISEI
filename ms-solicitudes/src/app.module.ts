import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controller/health.controller';
import { SolicitudesController } from './controller/solicitudes.controller';
import { CoordinacionController, RevisionController } from './controller/revision.controller';
import { PrismaService } from './repository/prisma.service';
import { EventosService } from './events/eventos.service';
import { SolicitudesService } from './service/solicitudes.service';
import { RevisionService } from './service/revision.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  // Coordinación y revisión van antes: /solicitudes/coordinacion y /solicitudes/revision no deben leerse como /solicitudes/:id
  controllers: [HealthController, CoordinacionController, RevisionController, SolicitudesController],
  providers: [PrismaService, EventosService, SolicitudesService, RevisionService],
})
export class AppModule {}
