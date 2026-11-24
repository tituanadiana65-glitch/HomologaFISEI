# Pruebas finales del sistema (T54)

Se repiten los casos del Sprint 1 y del Sprint 2 con el sistema actualizado al Sprint 3 (main con T39, T40 y T42), levantado con `docker compose up -d --build` en la computadora de Paola, con los planes cargados y la clave de Gemini en `.env`. Fecha: 13/11/2026. Responsable: Paola Taipe.

Las pruebas se hicieron contra la página http://localhost:5173 y su API (`/api/...`, la misma que usa la página), con cuentas nuevas creadas para T54: `final1.t54@uta.edu.ec` (solicitud 3004, TI → Software) y `final2.t54@uta.edu.ec`.

## Casos del Sprint 1

| # | Caso | Cómo se probó | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| S1-1 | Física TI → Física Software | Solicitud 3004: Física, nota 8.5, año 2025 | Homologable si los temas coinciden ≥ 80 % | **Homologable**. RN-01 contenidos 100 %, RN-02 créditos 3 de 3, RN-03 horas 144 de 144, RN-04 nota 8.5, RN-05 aprobada hace 1 año | OK |
| S1-2 | Cálculo Integral TI → Cálculo Integral Software | Solicitud 3004: Cálculo Integral, nota 8.5, año 2025 | No homologable por créditos 2 de 3 (66,66 %) y horas 96 de 144 | **No homologable**. RN-01 contenidos 90 % (cumple), RN-02 créditos 2 de 3 = 66,66 % (no cumple), RN-03 horas 96 de 144 = 66,66 % (no cumple). Temas que faltan: integral por cambio de variables y aplicaciones de ecuaciones diferenciales | OK |
| S1-3 | Física TI → Estructura de Datos Software | `POST /api/agente/homologar` con Física TI (UTA-FISEI-TI-MP-UB-01-04) y Estructura de Datos SW (UTA-FISEI-SF-MP-UB-03-02) | No homologable por contenidos (< 80 %) | **No homologable**. RN-01 no cumple: contenidos 0 % (física frente a estructuras de datos); RN-02 a RN-05 cumplen. Se probó directo en el gateway (puerto 3000, respondió 201 en 9,9 s) porque por la página (puerto 5173) dio 504, ver E-2 | OK |
| S1-4 | Física con nota 6.5 | `POST /api/agente/homologar` Física TI → Física SW, nota 6.5 | No homologable por nota (RN-04) | Solicitud 3006: **No homologable**, RN-04 no cumple: nota 6.5 (mínimo 7); las demás reglas cumplen | OK |
| S1-5 | Física aprobada en 2014 | `POST /api/agente/homologar` Física TI → Física SW, año 2014 | No homologable por vigencia (RN-05) | Solicitud 3007: **No homologable**, RN-05 no cumple: aprobada hace 12 años (máximo 10); las demás reglas cumplen | OK |
| S1-6 | Física sin `IA_API_KEY` | Se repite con CP-23 | Pendiente, con «falta el análisis de contenidos» | Ver CP-23 | |
| S1-7 | Importar un PDF que no es plan analítico | Administrador → importar el informe PDF de la solicitud 3004 como si fuera un plan | Rechazado (error 400) con el motivo | **400**: «informe-3004.pdf no parece un plan analítico de la FISEI: falta código, créditos, horas, unidades» | OK |
| S1-8 | Importar dos veces el mismo plan | Administrador → importar dos veces «PlanAlitico FUNDAMENTOS DE REDES Y COMUNICACION DE DATOS.pdf» | La materia no se duplica | Las dos veces responde 201 con la misma materia (UTA-FISEI-TI-MP-UB-03-05); TI sigue con **40** materias antes y después | OK |
| S1-9 | Carga completa de planes | `node scripts/cargar-planes.mjs` | 80 cargados, 0 con error | Pendiente (lo corre Paola en su computadora) | |
| S1-10 | Pruebas automáticas | `npm test` en cada servicio y CI en GitHub | Todas pasan, CI en verde | Pendiente (revisar la pestaña Actions de GitHub en el último merge de main) | |

## Casos del Sprint 2

| # | HU | Caso | Cómo se probó | Esperado | Obtenido | OK |
|---|---|---|---|---|---|---|
| CP-12 | HU-01 | Crear cuenta con el correo institucional | Registro de `final1.t54@uta.edu.ec` | Entra y pasa al paso 1 | **201**, devuelve token y usuario con rol ESTUDIANTE | OK |
| CP-13 | HU-01 | Correo que no es de la UTA | Registro con `prueba.t54@gmail.com` | «Usa tu correo institucional @uta.edu.ec» | **400**: «Usa tu correo institucional @uta.edu.ec» | OK |
| CP-14 | HU-01 | Contraseña incorrecta | Inicio de sesión de `final1.t54` con otra contraseña | No deja entrar y avisa | **401**: «Correo o contraseña incorrectos» | OK |
| CP-15 | HU-01 | Página privada sin iniciar sesión | Cerrar sesión y abrir http://localhost:5173/resultado | Lleva al inicio de sesión | La página regresa a `/` y muestra «Iniciar sesión». La API sin token responde **401** «Inicia sesión para continuar» | OK |
| CP-16 | HU-04 | Crear la solicitud | TI → Software, NOVIEMBRE 2026 - MARZO 2027 | Pasa al paso 2 | **201**, solicitud 3004 en estado BORRADOR | OK |
| CP-17 | HU-04 | Misma carrera en origen y destino | Con `final2.t54`: TI → TI | «La carrera de destino debe ser distinta a la de origen» | **400** con ese mensaje | OK |
| CP-18 | HU-04 | Una segunda solicitud abierta | Con `final1.t54`, crear otra solicitud | «Ya tienes una solicitud abierta» | **400** con ese mensaje | OK |
| CP-19 | HU-05 | Registrar dos materias | Física (PRIMERO, 8.5) y Cálculo Integral (SEGUNDO, 8.5), año 2025 | Las dos en la lista | Las dos quedan registradas (FISICA 8.5 y CALCULO INTEGRAL 8.5) | OK |
| CP-20 | HU-05 | Datos que no se aceptan | a) Física otra vez. b) Nota 11. c) Con `final2.t54`, solicitud sin materias | a) materia repetida. b) nota 0 a 10. c) botón desactivado | a) **400** «Esa materia ya está registrada en la solicitud». b) **400** «La nota debe estar entre 0 y 10». c) En /materias sale «Aún no registras materias» y el botón **Enviar a homologar** está desactivado | OK |
| CP-21 | HU-08 | Física y Cálculo Integral | Solicitud 3004 enviada | Física Homologable; Cálculo Integral No homologable (créditos 2/3) | Igual que S1-1 y S1-2 | OK |
| CP-22 | HU-08 | Materia sin equivalente | Fundamentos de Programación (nota 9) en la solicitud 3004 | Sin materia equivalente | **Sin materia equivalente** | OK |
| CP-23 | HU-08 | Sin clave de Gemini y reintento | Quitar `IA_API_KEY`, reiniciar `ms-agente-ia`, enviar Física; luego poner la clave y reintentar | Pendiente; tras reintentar, el resultado real | Pendiente (necesita cambiar el `.env` y reiniciar el agente en la computadora de Paola). En T33 (03/11) pasó | |
| CP-24 | HU-08 | La solicitud termina | Esperar la solicitud 3004 | RESULTADO_LISTO y botón del PDF activo | **RESULTADO_LISTO**, pero tardó unos **5 minutos** en 3 materias (ver errores) | OK |
| CP-25 | HU-20 | Descargar el informe | `GET /api/documentos/informes/3004` | PDF completo y evento `informe.generado` | **200**, `application/pdf`, 5616 bytes, empieza con `%PDF-`. En RabbitMQ la cola `homologafisei.auditoria` tiene el evento `informe.generado` de `ms-documentos` con `solicitudId: 3004` | OK |
| CP-26 | HU-20 | Informe de otra cuenta | Con `final2.t54`: `GET /api/documentos/informes/3004` | 403 | **403**: «Esta solicitud no es tuya» | OK |

> **Nota (24/11/2026): flujo anterior.** Estas pruebas se hicieron cuando el estudiante usaba el sistema. Desde el 23/11/2026 el estudiante **no** tiene cuenta: entrega sus papeles, el **coordinador** registra la solicitud y asigna un **docente**, y el docente hace la homologación. Por eso:
> - **CP-12 y CP-13** (crear cuenta) ya no aplican: no hay registro. `POST /api/identidad/registro` responde **401** y las cuentas del coordinador y los docentes las crea el administrador (ver CP-45 en `pruebas-sprint3.md`). Las cuentas de estudiante que ya existían tampoco pueden entrar.
> - **CP-14 y CP-15** (contraseña incorrecta y página privada sin sesión) siguen valiendo, ahora con las cuentas del personal.
> - **CP-16 a CP-18** (crear la solicitud) los hace el coordinador. «Una segunda solicitud abierta» ahora se controla por la **cédula** del estudiante: «Ya hay una solicitud en trámite para ese estudiante» (CP-57).
> - **CP-22** cambió: Fundamentos de Programación (TI) ahora sale **Homologable** con Algoritmos y Lógica de Programación (SW), porque el agente busca por temas cuando los nombres son distintos (CP-56).

### Casos extra encontrados en esta revisión

| Caso | Obtenido | OK |
|---|---|---|
| Un estudiante intenta importar un plan (`POST /api/catalogo/planes/importar`) | **403**: solo el administrador puede | OK |

## Errores encontrados

| # | Caso | Qué pasó | Quién lo corrige | Estado |
|---|---|---|---|---|
| E-1 | CP-24, S1-3 a S1-5 | El agente de IA es muy lento: la solicitud 3004 (3 materias) tardó unos 5 minutos en pasar a RESULTADO_LISTO, y una llamada a `/api/agente/homologar` no respondió en 35 segundos. En RabbitMQ la cola `ms-agente-ia.solicitudes` tenía 1 consumidor y 1 mensaje en proceso, así que no estaba caído sino esperando a Gemini (el agente espera hasta 90 s por consulta y reintenta con 2 s y 5 s). Para la revisión conviene probar la clave de Gemini antes y avisar que puede tardar | Emmanuel (agente) | Abierto |
| E-2 | S1-3 | Al homologar desde la página (puerto 5173), `/api/agente/homologar` responde **504 Gateway Time-out** justo a los 60 s. El nginx de `web` corta a los 60 s (valor por defecto de `proxy_read_timeout`), pero el gateway espera hasta 120 s y el agente hasta 90 s. Arreglo: en `web/nginx.conf`, dentro de `location /api/`, agregar `proxy_read_timeout 180s;` y reconstruir `web` | Paola (T21, nginx) | Corregido en T53 |

## En el servidor de prueba (T53)

Servidor: GitHub Codespaces (máquina de 4 núcleos), configurado en `.devcontainer/devcontainer.json` con la imagen `universal:2`. Al encender el Codespace se ejecuta `docker compose up --build -d`. La página se publica en el puerto 5173 con visibilidad pública: https://potential-memory-g546xvq6x9j26xq-5173.app.github.dev (solo funciona mientras el Codespace está encendido).

Fecha: 15/11/2026. Cuentas `srv1.t53@uta.edu.ec` y `srv2.t53@uta.edu.ec`. Base de datos nueva: solicitud 1.

| Caso | Resultado en el servidor | ¿OK? |
|---|---|---|
| S1-9 | `node scripts/cargar-planes.mjs`: **Cargados: 80 · Con error: 0** | OK |
| CP-12 | **201**, token y rol ESTUDIANTE | OK |
| CP-13 | **400**: «Usa tu correo institucional @uta.edu.ec» | OK |
| CP-14 | **401**: «Correo o contraseña incorrectos» | OK |
| CP-15 | **401** sin token: «Inicia sesión para continuar» | OK |
| CP-16 | **201**, solicitud 1 en BORRADOR | OK |
| CP-17 | **400**: «La carrera de destino debe ser distinta a la de origen» | OK |
| CP-18 | **400**: «Ya tienes una solicitud abierta» | OK |
| CP-19 | Física, Cálculo Integral y Fundamentos de Programación registradas (**201**) | OK |
| CP-20 | a) **400** «Esa materia ya está registrada en la solicitud». b) **400** «La nota debe estar entre 0 y 10». c) **400** «Registra al menos una materia antes de enviar» | OK |
| CP-21 | Física **Homologable** (contenidos 100 %); Cálculo Integral **No homologable** | OK |
| CP-22 | Fundamentos de Programación: **Sin materia equivalente** | OK |
| CP-23 | Las materias quedaron **Pendiente** mientras el agente no tenía clave ni base de datos (ver E-3 y E-4); `POST /api/solicitudes/1/reintentar` respondió **201** («reintentadas: 3») y la solicitud pasó a RESULTADO_LISTO con los resultados reales | OK |
| CP-24 | **RESULTADO_LISTO** | OK |
| CP-25 | **200**, `application/pdf`, 5823 bytes, empieza con `%PDF-` | OK |
| CP-26 | Con `srv2.t53`: **403** «Esta solicitud no es tuya» | OK |
| S1-3 (E-2) | `POST /api/agente/homologar` por la página: **504 a los 100 s**. El arreglo de nginx funcionó (antes cortaba a los 60 s), pero el reenvío de puertos de Codespaces corta a unos 100 s. Queda abierto con E-1 | Ver E-1 |

> Estos resultados también son del flujo anterior (el estudiante con cuenta propia). Ver la nota de arriba.

### Errores encontrados en el servidor

| N.º | Caso | Error | Quién lo arregla | Estado |
|---|---|---|---|---|
| E-3 | Arranque | Al encender o reiniciar el Codespace, `ms-agente-ia`, `ms-catalogo` y `ms-solicitudes` arrancan antes de que SQL Server esté listo («P1001: Can't reach database server at sqlserver:1433») y quedan en *Restarting*. Solución temporal: `docker compose restart ms-catalogo ms-solicitudes ms-agente-ia`. El `docker-compose.yml` ya tiene `depends_on` con `service_healthy`, pero al reiniciar el Codespace Docker vuelve a encender los contenedores por su política de reinicio sin esperar a SQL Server. Arreglo propuesto: que el `postStartCommand` del devcontainer, después de `docker compose up`, espere a SQL Server y reinicie esos tres servicios | Paola (docker-compose) | Abierto |
| E-4 | Configuración | El secreto `IA_API_KEY` del repositorio no llegó al Codespace. Se usó un `.env` creado dentro del Codespace (no se sube a GitHub). Revisar que el secreto esté en **Settings → Secrets and variables → Codespaces** con el nombre exacto | Diana (dueña del repositorio) | Abierto |
| E-5 | Agente | Gemini respondió «This model is currently experiencing high demand»; el agente reintentó y terminó bien, pero la solicitud tardó varios minutos. Relacionado con E-1 | Emmanuel (agente) | Abierto |

### Pasos cada vez que se enciende el Codespace

1. Esperar a que termine `docker compose up --build -d` y revisar `docker compose ps`.
2. Si algún servicio está en *Restarting*: `docker compose restart ms-catalogo ms-solicitudes ms-agente-ia` (E-3).
3. En la pestaña **Puertos**, poner el 5173 en **Public** (vuelve a privado al reiniciar).
4. Detener el Codespace al terminar para no gastar las horas gratis.
