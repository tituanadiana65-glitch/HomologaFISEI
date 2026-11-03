# Pruebas del Sprint 2

Pruebas de aceptación de las historias del Sprint 2. Se hacen en la página http://localhost:5173 con el sistema levantado (`docker compose up -d --build`), los 80 planes cargados y la clave de Gemini en el archivo `.env`.

Cómo llenarlas: hacer cada caso tal como dice la columna **Pasos**, anotar en **Obtenido** lo que pasó y marcar **OK** si coincide con lo **Esperado**. Guardar una captura de cada caso en la carpeta de evidencias.

Datos de prueba: estudiante `prueba.sprint2@uta.edu.ec`, contraseña `Prueba2026*`, de **Tecnologías de la Información (TI)** a **Software**, con **Física** (primer nivel) y **Cálculo Integral** (segundo nivel).

## T26 · HU-01, HU-04 y HU-05 (Diana Tituaña)

### HU-01 · Registro e inicio de sesión

| # | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| CP-12 | Crear cuenta con el correo institucional | Pestaña **Crear cuenta**, escribir nombre, `prueba.sprint2@uta.edu.ec` y una contraseña de 8 o más caracteres | Entra al sistema y pasa al paso 1 «Nueva solicitud» | | |
| CP-13 | Crear cuenta con un correo que no es de la UTA | Pestaña **Crear cuenta** con `prueba@gmail.com` | No deja crear la cuenta y dice «Usa tu correo institucional @uta.edu.ec» | | |
| CP-14 | Entrar con una contraseña incorrecta | Pestaña **Iniciar sesión** con el correo de CP-12 y otra contraseña | No deja entrar y dice «Correo o contraseña incorrectos» | | |
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

| # | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| CP-21 | | | | | |
| CP-22 | | | | | |
| CP-23 | | | | | |
| CP-24 | | | | | |
| CP-25 | | | | | |
| CP-26 | | | | | |

## Pruebas automáticas

Se corren solas en GitHub cada vez que se sube un cambio (la integración continua debe salir en verde).

| Servicio | Pruebas | Qué revisan |
|---|---|---|
| ms-identidad | 11 | Correo @uta.edu.ec, largo de la contraseña, contraseña guardada protegida, inicio de sesión correcto e incorrecto |
| ms-solicitudes | 26 | Crear y ver la solicitud, carreras distintas, una sola solicitud abierta, agregar y quitar materias, enviar, guardar el resultado y reintentar las pendientes |
| api-gateway | 9 | Las páginas privadas piden iniciar sesión y las de administración solo las ve el administrador |
