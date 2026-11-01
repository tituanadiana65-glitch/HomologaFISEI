import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { connect, type Channel, type ChannelModel } from 'amqplib';

const EXCHANGE = 'homologafisei';
const COLA_AUDITORIA = 'homologafisei.auditoria';

// Publica eventos en RabbitMQ (exchange "homologafisei", tipo topic).
// Si RabbitMQ no está disponible, el servicio sigue funcionando y solo avisa en el log.
@Injectable()
export class EventosService implements OnModuleDestroy {
  private readonly log = new Logger(EventosService.name);
  private conexion?: ChannelModel;
  private canal?: Channel;

  private async abrir(): Promise<Channel | undefined> {
    const url = process.env.RABBITMQ_URL;
    if (!url) return undefined;
    if (this.canal) return this.canal;
    try {
      this.conexion = await connect(url);
      this.conexion.on('error', (e: Error) => this.log.warn(`RabbitMQ: ${e.message}`));
      this.conexion.on('close', () => {
        this.canal = undefined;
        this.conexion = undefined;
      });
      const canal = await this.conexion.createChannel();
      await canal.assertExchange(EXCHANGE, 'topic', { durable: true });
      // Cola que guarda todos los eventos para revisarlos en el panel de RabbitMQ
      await canal.assertQueue(COLA_AUDITORIA, { durable: true });
      await canal.bindQueue(COLA_AUDITORIA, EXCHANGE, '#');
      this.canal = canal;
      return canal;
    } catch (e) {
      this.log.warn(`RabbitMQ no disponible: ${(e as Error).message}`);
      return undefined;
    }
  }

  async publicar(evento: string, datos: unknown): Promise<boolean> {
    const canal = await this.abrir();
    if (!canal) return false;
    const mensaje = { evento, servicio: process.env.SERVICIO, fecha: new Date().toISOString(), datos };
    return canal.publish(EXCHANGE, evento, Buffer.from(JSON.stringify(mensaje)), {
      contentType: 'application/json',
      persistent: true,
    });
  }

  // Escucha una clave del exchange y llama a manejar(datos) por cada mensaje.
  async escuchar(cola: string, clave: string, manejar: (datos: any) => Promise<void>) {
    if (!process.env.RABBITMQ_URL) return; // en las pruebas no hay RabbitMQ
    const canal = await this.abrir();
    if (!canal) {
      setTimeout(() => void this.escuchar(cola, clave, manejar), 5000); // reintenta
      return;
    }
    await canal.assertQueue(cola, { durable: true });
    await canal.bindQueue(cola, EXCHANGE, clave);
    await canal.consume(cola, async (msg) => {
      if (!msg) return;
      try {
        const { datos } = JSON.parse(msg.content.toString());
        await manejar(datos);
        canal.ack(msg);
      } catch (e) {
        this.log.warn(`No se pudo procesar ${clave}: ${(e as Error).message}`);
        canal.nack(msg, false, false);
      }
    });
  }

  async onModuleDestroy() {
    await this.conexion?.close().catch(() => undefined);
  }
}
