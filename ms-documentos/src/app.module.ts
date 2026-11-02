import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controller/health.controller';
import { EventosService } from './events/eventos.service';
import { InformesController } from './controller/informes.controller';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, InformesController],
  providers: [EventosService],
})
export class AppModule {}
