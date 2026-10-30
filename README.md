# HomologaFISEI

Sistema web para homologar asignaturas en los cambios de carrera de la FISEI (Universidad Técnica de Ambato). Lee los planes analíticos en PDF, compara los contenidos con un agente de IA (Gemini de Google, gratuito), aplica las reglas de la FISEI y entrega un resultado por materia (**Homologable**, **No homologable** o **Pendiente**) con un informe que explica cada regla.

Equipo: José Taipe (Scrum Master), Diana Tituaña (Product Owner), Paola Taipe y Emmanuel Acosta.

## Qué necesitas instalar

| Programa | Para qué | ¿Obligatorio? |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Levanta todo el sistema (base de datos, mensajería y microservicios) | Sí |
| [Git](https://git-scm.com/) | Bajar y subir el código | Sí |
| [Node.js 24](https://nodejs.org/) | Correr las pruebas y programar | Solo para programar |
| Clave gratuita de Gemini ([aistudio.google.com/apikey](https://aistudio.google.com/apikey), sin tarjeta) | Análisis de contenidos del agente de IA | Sin ella el sistema funciona, pero el resultado sale "Pendiente" |

SQL Server, RabbitMQ y NestJS **no** se instalan aparte: Docker los descarga solo.

## Levantar el sistema (primera vez)

1. Abre **Docker Desktop** y espera a que diga *Engine running*.
2. Baja el proyecto:
   ```powershell
   git clone https://github.com/tituanadiana65-glitch/HomologaFISEI.git
   cd HomologaFISEI
   ```
3. Crea tu archivo `.env` a partir del ejemplo y pon la clave de Gemini en `IA_API_KEY`:
   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```
4. Levanta todo:
   ```powershell
   docker compose up -d --build
   ```
   La primera vez tarda varios minutos.

   **Atajo en Windows:** doble clic en `INICIAR.bat`. Hace los pasos 3 a 6 solo (pide la clave de Gemini, levanta todo, carga los planes, prueba una homologación y abre la página) y guarda el registro en `logs\inicio.log`. También se puede ejecutar así:
   ```powershell
   powershell -ExecutionPolicy Bypass -File scripts\iniciar.ps1
   ```
5. Abre **http://localhost:3000**.
6. Carga los 80 planes analíticos (40 de TI y 40 de Software, en la carpeta `planes/`). Puedes subirlos desde la página o con el script:
   ```powershell
   node scripts/cargar-planes.mjs
   ```
   Si las carpetas están en otro lugar, pásalas como argumentos: `node scripts/cargar-planes.mjs "C:/ruta/TI" "C:/ruta/SW"`.

## Uso diario

| Acción | Comando |
|---|---|
| Encender | `docker compose up -d` |
| Ver estado | `docker compose ps` |
| Ver errores de un servicio | `docker compose logs ms-catalogo --tail 50` |
| Apagar (los datos se guardan) | `docker compose down` |
| Reconstruir después de un `git pull` | `docker compose up -d --build` |
| Borrar también la base de datos | `docker compose down -v` |

## Caso de la demo (Sprint Review)

En la página, elige **Cálculo Integral** de TI (2 créditos, 96 h) como materia aprobada y **Cálculo Integral** de Software (3 créditos, 144 h) como materia nueva, con nota 8.5 y año 2025. El resultado es **No homologable**: los temas coinciden, pero los créditos dan 2/3 = 66,66 % y las horas 96/144 = 66,66 %, ambos bajo el 80 % (RN-02 y RN-03). Con **Física** de TI y **Física** de Software (3 créditos y 144 h en ambas) el resultado es **Homologable**.

## Agente de IA gratuito

El agente compara los temas de dos materias (RN-01) usando una API compatible con OpenAI. Se elige en `.env`:

| `IA_PROVEEDOR` | Costo | Clave | Modelo por defecto |
|---|---|---|---|
| `gemini` (recomendado) | Gratis, sin tarjeta | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | `gemini-flash-latest` |
| `groq` | Gratis, sin tarjeta | [console.groq.com/keys](https://console.groq.com/keys) | `llama-3.3-70b-versatile` |
| `ollama` | Gratis, corre en tu PC, sin internet | No necesita (instalar [ollama.com](https://ollama.com) y `ollama pull qwen2.5:7b`) | `qwen2.5:7b` |

Los planes gratuitos tienen un límite de consultas por minuto. Si se supera, el resultado sale "Pendiente" y basta con esperar un minuto. Para cambiar de proveedor: edita `.env` y ejecuta `docker compose up -d ms-agente-ia`.

## Arquitectura

Microservicios con NestJS. Cada uno tiene su propia base de datos en SQL Server (Prisma como ORM) y todos se publican a través del API Gateway.

| Servicio | Puerto | Qué hace | Base de datos |
|---|---|---|---|
| `api-gateway` | 3000 | Puerta de entrada y página de demo. Reenvía `/api/catalogo`, `/api/reglas` y `/api/agente` | — |
| `ms-catalogo` | 3002 | Lee los planes analíticos en PDF y guarda carreras, asignaturas, unidades y requisitos | `catalogo_db` |
| `ms-motor-reglas` | 3004 | Reglas RN-02 a RN-05 (créditos, horas, nota, vigencia) con valores que el administrador puede cambiar | `reglas_db` |
| `ms-agente-ia` | 3005 | Agente de IA (Gemini, Groq u Ollama) para comparar contenidos (RN-01), arma el resultado y el informe | `homologacion_db` |
| `sqlserver` | 1433 | SQL Server 2022 (usuario `sa`, clave `Homologa2026*`) | — |
| `rabbitmq` | 5672 / 15672 | Mensajería de eventos. Panel: http://localhost:15672 (`guest` / `guest`) | — |

Al arrancar, cada servicio crea su base y sus tablas (`prisma db push`). El catálogo registra las carreras TI y SW, y el motor carga las reglas iniciales de `docs/reglas.md`. Cualquier otra carrera de la FISEI se crea sola al importar su plan.

Eventos publicados en RabbitMQ (exchange `homologafisei`, copia en la cola `homologafisei.auditoria`):

- `plan.importado`: cuando el catálogo guarda un plan.
- `homologacion.completada`: cuando el agente termina una homologación.

### Endpoints principales (a través del gateway)

| Método | Ruta | Para qué |
|---|---|---|
| POST | `/api/catalogo/planes/importar?carrera=TI` | Subir un plan en PDF (campo `archivo`). La carrera es opcional: se deduce del código del plan |
| GET | `/api/catalogo/carreras` | Carreras con su número de asignaturas |
| GET | `/api/catalogo/asignaturas?carrera=SW&buscar=calculo` | Lista de asignaturas |
| GET | `/api/catalogo/asignaturas/{codigo}` | Asignatura con unidades y requisitos |
| GET | `/api/reglas/reglas` | Reglas y sus valores |
| POST | `/api/reglas/evaluar` | `{ origen: {creditos, horas, nota, anio}, destino: {creditos, horas} }` |
| POST | `/api/agente/comparar` | `{ codigoAprobada, codigoNueva }`: solo contenidos (RN-01) |
| POST | `/api/agente/homologar` | `{ codigoAprobada, codigoNueva, nota, anio }`: resultado e informe |
| GET | `/api/agente/homologaciones` | Últimas homologaciones; `/{id}` devuelve su informe |

## Programar y probar

Cada servicio es un proyecto NestJS independiente con pruebas en Jest (se escriben primero, TDD).

```powershell
cd ms-motor-reglas
npm install
npx prisma generate
npm test
npm run lint
npm run build
```

La integración continua (`.github/workflows/ci.yml`) corre `lint`, `test` y `build` de los cuatro servicios en cada Pull Request a `main`.

Forma de trabajo: una rama por tarea (`feature/T10-reglas`), un Pull Request hacia `main`, revisión de un compañero y CI en verde antes de unir.

## Documentos

- `docs/reglas.md`: reglas de homologación de la FISEI con su base legal y ejemplos.
- `docs/pruebas-sprint1.md`: casos de prueba del Sprint 1.
- `docs/casos-de-uso.png` (T14) y `docs/clases.png` (T15): diagramas del sprint, con su fuente PlantUML (`.puml`).

## Problemas comunes

| Síntoma | Solución |
|---|---|
| Un servicio dice `Restarting` en `docker compose ps` | `docker compose logs <servicio> --tail 50` y revisa el mensaje. SQL Server tarda unos 30 s la primera vez; espera y revisa de nuevo |
| El resultado sale "Pendiente" | Falta o está mal `IA_API_KEY` en `.env`, o se alcanzó el límite gratuito por minuto. Corrige la clave y ejecuta `docker compose up -d ms-agente-ia`, o espera un minuto |
| "No existe la asignatura" | Carga primero los planes analíticos (paso 6) |
| El puerto 1433 o 3000 ya está en uso | Cierra el otro programa que lo usa (otro SQL Server, otro proyecto en Docker) |
| `npm test` falla con "Must use import to load ES Module" | Usa Node.js 24 o superior |
