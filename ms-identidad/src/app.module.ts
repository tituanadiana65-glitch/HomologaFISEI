import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controller/health.controller';
import { IdentidadController } from './controller/identidad.controller';
import { PrismaService } from './repository/prisma.service';
import { IdentidadService } from './service/identidad.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, IdentidadController],
  providers: [PrismaService, IdentidadService],
})
export class AppModule {}