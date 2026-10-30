import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controller/health.controller';
import { ReglasController } from './controller/reglas.controller';
import { PrismaService } from './repository/prisma.service';
import { ReglasRepository } from './repository/reglas.repository';
import { ReglasService } from './service/reglas.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, ReglasController],
  providers: [PrismaService, ReglasRepository, ReglasService],
})
export class AppModule {}
