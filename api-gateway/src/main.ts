import { NestFactory } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app.module';

async function bootstrap() {
  // bodyParser: false para que el gateway reenvíe el cuerpo tal cual (JSON y archivos PDF)
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const rutas: Record<string, string> = {
    catalogo: process.env.MS_CATALOGO ?? 'http://localhost:3002',
    reglas: process.env.MS_REGLAS ?? 'http://localhost:3004',
    agente: process.env.MS_AGENTE ?? 'http://localhost:3005',
  };
  for (const [nombre, destino] of Object.entries(rutas)) {
    app.use(`/api/${nombre}`, createProxyMiddleware({ target: destino, changeOrigin: true }));
  }
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();