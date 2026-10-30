import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controller/health.controller';
import { PlanesController } from './controller/planes.controller';
import { AsignaturasController } from './controller/asignaturas.controller';
import { PrismaService } from './repository/prisma.service';
import { PlanesRepository } from './repository/planes.repository';
import { EventosService } from './events/eventos.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, PlanesController, AsignaturasController],
  providers: [PrismaService, PlanesRepository, EventosService],
})
export class AppModule {}
