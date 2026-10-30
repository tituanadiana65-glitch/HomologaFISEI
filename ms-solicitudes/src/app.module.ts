import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controller/health.controller';
import { PrismaService } from './repository/prisma.service';
import { EventosService } from './events/eventos.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController],
  providers: [PrismaService, EventosService],
})
export class AppModule {}
