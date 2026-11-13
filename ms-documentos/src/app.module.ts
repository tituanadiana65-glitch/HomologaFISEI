import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controller/health.controller';
import { InformesController } from './controller/informes.controller';
import { ArchivosController } from './controller/archivos.controller';
import { EventosService } from './events/eventos.service';
import { ArchivosService } from './service/archivos.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, InformesController, ArchivosController],
  providers: [EventosService, ArchivosService],
})
export class AppModule {}
