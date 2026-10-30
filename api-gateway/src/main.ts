import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { AppModule } from './app.module';

// Rutas del API Gateway: /api/<nombre>/... se reenvía al microservicio
export const RUTAS: Record<string, string> = {
  catalogo: process.env.MS_CATALOGO ?? 'http://localhost:3002',
  reglas: process.env.MS_REGLAS ?? 'http://localhost:3004',
  agente: process.env.MS_AGENTE ?? 'http://localhost:3005',
};

async function bootstrap() {
  // bodyParser: false para que el gateway reenvíe el cuerpo tal cual (JSON y archivos PDF)
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  for (const [nombre, destino] of Object.entries(RUTAS)) {
    app.use(
      `/api/${nombre}`,
      createProxyMiddleware({
        target: destino,
        changeOrigin: true,
        proxyTimeout: 120_000, // el agente de IA puede tardar varios segundos
        on: {
          error: (_err, _req, res) => {
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(502, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ message: `El servicio ${nombre} no responde. Revisa "docker compose ps".` }));
            }
          },
        },
      }),
    );
  }
  // Página de demostración del Sprint 1 en http://localhost:3000
  app.useStaticAssets(join(__dirname, '..', 'public'));
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
