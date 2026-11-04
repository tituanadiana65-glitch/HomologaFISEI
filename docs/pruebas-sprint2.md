# Pruebas del Sprint 2

Pruebas de aceptación de las historias del Sprint 2. Se hacen en la página http://localhost:5173 con el sistema levantado (`docker compose up -d --build`), los 80 planes cargados y la clave de Gemini en el archivo `.env`.

Cómo llenarlas: hacer cada caso tal como dice la columna **Pasos**, anotar en **Obtenido** lo que pasó y marcar **OK** si coincide con lo **Esperado**. Las capturas están en la carpeta `docs/evidencias`, con el número del caso como nombre (por ejemplo `CP-13.png`).

Datos de prueba: estudiante `prueba.sprint2@uta.edu.ec`, contraseña `Prueba2026*`, de **Tecnologías de la Información (TI)** a **Software**, con **Física** (primer nivel) y **Cálculo Integral** (segundo nivel).

## T26 · HU-01, HU-04 y HU-05 (Diana Tituaña)

### HU-01 · Registro e inicio de sesión

| # | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| CP-12 | Crear cuenta con el correo institucional | Pestaña **Crear cuenta**, escribir nombre, `prueba.sprint2@uta.edu.ec` y una contraseña de 8 o más caracteres | Entra al sistema y pasa al paso 1 «Nueva solicitud» | | |
| CP-13 | Crear cuenta con un correo que no es de la UTA | Pestaña **Crear cuenta** con `prueba@gmail.com` | No deja crear la cuenta y dice «Usa tu correo institucional @uta.edu.ec» | Con `diana@gmail.com` no deja crear la cuenta y muestra «Usa tu correo institucional @uta.edu.ec» ([captura](evidencias/CP-13.png)) | OK |
| CP-14 | Entrar con una contraseña incorrecta | Pestaña **Iniciar sesión** con el correo de CP-12 y otra contraseña | No deja entrar y avisa que el correo o la contraseña son incorrectos | No deja entrar y muestra «Correo o contraseña incorrecta» ([captura](evidencias/CP-14.png)) | OK |
| CP-15 | Ver una página privada sin iniciar sesión | Cerrar sesión y abrir directamente http://localhost:5173/resultado | No muestra la página y lleva al inicio de sesión | | |

### HU-04 · Crear la solicitud de cambio de carrera

| # | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| CP-16 | Crear la solicitud | Con la sesión de CP-12, elegir origen **TI**, destino **Software** y el periodo, y pulsar **Crear solicitud** | Se crea la solicitud y pasa al paso 2 «Materias» | | |
| CP-17 | Misma carrera en origen y destino | Con otra cuenta nueva, elegir **TI** en origen y en destino | No deja crear la solicitud y dice «La carrera de destino debe ser distinta a la de origen» | | |
| CP-18 | Una segunda solicitud abierta | Con la cuenta de CP-16, intentar crear otra solicitud | No deja crearla y dice «Ya tienes una solicitud abierta» | | |

### HU-05 · Registrar las materias aprobadas

| # | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| CP-19 | Registrar dos materias | En el paso 2, agregar **Física** (PRIMERO, paralelo A, docente, periodo, año 2025, nota 8.5, matrícula 1) y **Cálculo Integral** (SEGUNDO, nota 7.5) | Las dos aparecen en la lista de materias de la solicitud | | |
| CP-20 | Datos que no se aceptan | a) Agregar otra vez **Física**. b) Agregar una materia con nota 11. c) Con otra cuenta, dejar la solicitud sin materias | a) «Esa materia ya está registrada en la solicitud». b) «La nota debe estar entre 0 y 10». c) El botón **Enviar a homologar** queda desactivado | | |

Además, el formulario solo muestra las materias de la carrera de origen, así que no se puede escoger una materia de otra carrera; si alguien la envía igual, el sistema responde «La materia no es de tu carrera de origen».

## T33 · HU-08 y HU-20 (Paola Taipe)

Casos CP-21 a CP-26: resultado de cada materia y descarga del informe en PDF.

### HU-08 · Homologar la solicitud

| # | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| CP-21 | Resultado de Física y Cálculo Integral | Con una cuenta nueva, solicitud de **TI** a **Software** con **Física** (PRIMERO, nota 8.5, año 2025) y **Cálculo Integral** (SEGUNDO, nota 8.5, año 2025), y pulsar **Enviar a homologar** | Física **Homologable**; Cálculo Integral **No homologable** por créditos 2 de 3 = 66,66 %, cada una con su explicación en **Ver detalle** | Física **Homologable**. Cálculo Integral **No homologable**: RN-01 cumple (contenidos 88 %), RN-02 no cumple (créditos 2 de 3 = 66,66 %), RN-03 no cumple (horas 96 de 144 = 66,66 %), RN-04 y RN-05 cumplen; muestra los temas que faltan ([captura](evidencias/CP-21.png), [detalle](evidencias/CP-21-detalle.png)) | OK |
| CP-22 | Materia sin equivalente | Con otra cuenta, solicitud de **TI** a **Software** con **Fundamentos de Programación** (nota 9, año 2025) y enviar | **Sin materia equivalente** | **Sin materia equivalente** ([captura](evidencias/CP-22.png)) | OK |
| CP-23 | Sin clave de Gemini y reintento | Dejar `IA_API_KEY` vacía en `.env` y reiniciar `ms-agente-ia`; enviar una solicitud con **Física**. Luego poner la clave, reiniciar `ms-agente-ia` y pulsar **Reintentar las pendientes** | Primero **Pendiente**; tras reintentar, el resultado real | Sin la clave, Física queda **Pendiente** con el botón **Reintentar las pendientes** ([captura](evidencias/CP-23-pendiente.png)). Con la clave y el reintento pasa a **Homologable** | OK |
| CP-24 | La solicitud termina | Esperar a que todas las materias de CP-21 tengan resultado | La solicitud pasa a `RESULTADO_LISTO` | Aparece «Tu resultado está listo. Puedes descargar el informe en PDF», los tres pasos en verde y el botón del PDF se activa ([captura](evidencias/CP-21.png)) | OK |

### HU-20 · Informe en PDF

| # | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| CP-25 | Descargar el informe | En el resultado de una solicitud lista, pulsar **Descargar informe en PDF** | El PDF trae los datos, las carreras, la fecha, cada materia con sus reglas y la nota del Consejo Directivo | El PDF trae estudiante, N.º de solicitud, fecha, carreras, periodo, resumen por resultado, cada materia con su resultado, reglas (Cumple / No cumple) y temas que faltan, y la nota del Consejo Directivo | OK |
| CP-26 | Informe de otra cuenta | Con otra cuenta, pedir `GET /api/documentos/informes/2003` (solicitud de otra estudiante) desde la consola del navegador | Respuesta **403** | **403**: «Esta solicitud no es tuya» | OK |

Además, ms-documentos responde **400** «El resultado todavía no está listo» si la solicitud sigue en borrador, y **404** si no existe.

### Primera vez y correcciones

- **CP-21** falló la primera vez: la página respondía «Cannot POST /» al crear la solicitud porque el gateway quitaba el prefijo `/solicitudes`. Se corrigió con `pathRewrite` en `api-gateway/src/main.ts`.
- **CP-24** falló la primera vez: las materias se quedaban en «En revisión» porque ms-solicitudes no recibía `solicitud.homologada`. Se corrigió con T28.
- **CP-23** se quedó la primera vez en «En revisión»: ms-agente-ia había perdido la conexión con RabbitMQ. Se resolvió reiniciando los servicios (`docker compose down` y `docker compose up -d --build`).
- **CP-22, CP-25 y CP-26** pasaron a la primera.

## Pruebas automáticas

Se corren solas en GitHub cada vez que se sube un cambio (la integración continua debe salir en verde).

| Servicio | Pruebas | Qué revisan |
|---|---|---|
| ms-identidad | 11 | Correo @uta.edu.ec, largo de la contraseña, contraseña guardada protegida, inicio de sesión correcto e incorrecto |
| ms-solicitudes | 26 | Crear y ver la solicitud, carreras distintas, una sola solicitud abierta, agregar y quitar materias, enviar, guardar el resultado y reintentar las pendientes |
| api-gateway | 9 | Las páginas privadas piden iniciar sesión y las de administración solo las ve el administrador |
| ms-documentos | 3 | El servicio responde; el PDF se genera con y sin reglas y temas que faltan |
| web | — | El sitio compila sin errores (`npm run build`) |
