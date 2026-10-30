import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './controller/health.controller';
import { AgenteController } from './controller/agente.controller';
import { PrismaService } from './repository/prisma.service';
import { AgenteService } from './service/agente.service';
import { ClientesService } from './service/clientes.service';
import { HomologacionService } from './service/homologacion.service';
import { EventosService } from './events/eventos.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [HealthController, AgenteController],
  providers: [PrismaService, AgenteService, ClientesService, HomologacionService, EventosService],
})
export class AppModule {}
