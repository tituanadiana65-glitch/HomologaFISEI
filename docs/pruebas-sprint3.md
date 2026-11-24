# Pruebas del Sprint 3 · estudiante de otra universidad (T47)

Pruebas de aceptación de HU-16, HU-24, HU-17 y HU-28. Se hicieron en la página http://localhost:5173 de la computadora de Diana, con el sistema actualizado a main (Sprint 3 completo) y la clave de Gemini en `.env`. Fecha: 19/11/2026. Responsable: Diana Tituaña.

Datos: cuenta de prueba `ext1.t47@uta.edu.ec`, solicitud **3002**, de la *Universidad Central del Ecuador · Ingeniería en Computación* a **Software**, 2 periodos aprobados, documentos legalizados. Como sílabos se usaron planes analíticos de TI (tienen texto que se puede leer): el de Cálculo Integral para «Cálculo II» y el de Física para «Física General».

| # | HU | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|---|
| CP-27 | HU-16 | Solicitud de otra universidad | Elegir «Vengo de otra universidad», escribir universidad y carrera, 2 periodos, marcar legalizados y crear | Se crea como solicitud de otra universidad y pasa al paso 2 | Solicitud 3002, tipo EXTERNO, periodos 2, legalizados sí; la página pasa a «Tus materias aprobadas» | OK |
| CP-28 | HU-16 | Subir malla y récord en PDF | Subir dos PDF con texto | Los acepta y lee su texto | «✓ … 7.617 caracteres leídos» y «✓ … 10.416 caracteres leídos»; la solicitud guarda los dos documentos | OK |
| CP-29 | HU-16 / HU-24 | Registrar materias con sílabo y nota en otra escala | Cálculo II (4 cr, 160 h, 16 sobre 20, 2025, sílabo) y Física General (3 cr, 144 h, 85 sobre 100, 2024, sílabo) | Quedan registradas con la nota original y la convertida | «16 / 20 → 8,0 / 10» y «85 / 100 → 8,5 / 10» ([captura](evidencias/CP-29-materias.jpg)) | OK |
| CP-30 | HU-24 | Nota mayor que su escala | Nota 25 sobre 20 | La rechaza y explica | «La nota debe estar entre 0 y 20» | OK |
| CP-31 | HU-16 | Materia repetida con otra forma de escribirla | Registrar «CÁLCULO  II» (tildes y doble espacio) | La rechaza | **400** «Esa materia ya está registrada en la solicitud» | OK |
| CP-32 | HU-17 | Materia con otro nombre: buscar la más parecida por temas | Enviar a homologar «Física General» | Encuentra FÍSICA de Software por sus temas | **FÍSICA (UTA-FISEI-SF-MP-UB-01-01)**, parecido **98 %**, contenidos 100 %, **Homologable** | OK |
| CP-33 | HU-17 / HU-28 | Reglas con los datos de otra universidad | Enviar a homologar «Cálculo II» | Se evalúan RN-01 a RN-05 con el sílabo y los datos escritos | **CÁLCULO INTEGRAL, Homologable**: RN-01 contenidos 90 %, RN-02 créditos 4 de 3 = 133,33 %, RN-03 horas 160 de 144 = 111,11 %, RN-04 «16/20 equivale a 8,0/10 (mínimo 7)», RN-05 aprobada hace 1 año. Temas que faltan: integral por cambio de variables; aplicaciones de ecuaciones diferenciales | OK |
| CP-34 | HU-17 | Requisitos de otra universidad (RN-08) | Al terminar la evaluación | Aviso de RN-08 con la causa de cada requisito | «✓ Cumples los requisitos para cambiarte desde otra universidad (RN-08)»: 2 periodos, 2 materias homologables, documentos legalizados ([captura](evidencias/CP-34-rn08.jpg)) | OK |
| CP-35 | HU-17 | Materia sin sílabo | «Contabilidad General» registrada sin sílabo | Sin materia equivalente o un aviso, sin trabar la solicitud | **Error E-6** (ver abajo): quedaba *Pendiente* para siempre. Después del arreglo: **Sin materia equivalente** y la solicitud pasa a «Resultado listo»; además, el sistema ya no deja registrar una materia sin sílabo | OK (tras el arreglo) |
| CP-36 | HU-28 | Informe en PDF de otra universidad | Descargar el informe | PDF con universidad de origen, resumen, RN-08 y detalle por materia | **200**, `application/pdf`, 6.210 bytes, 2 páginas: universidad de origen, resumen (2 homologables, 1 sin equivalente), RN-08 cumple y detalle por materia ([captura](evidencias/CP-36-pdf.jpg)) | OK |

**Resultado: 10 de 10 casos OK**, uno de ellos después de corregir el error E-6.

## Errores encontrados

| N.º | Caso | Qué pasó | Arreglo | Estado |
|---|---|---|---|---|
| E-6 | CP-35 | Una materia de otra universidad sin sílabo quedaba **Pendiente** para siempre. Reintentar no la arreglaba, así que la solicitud nunca pasaba a «Resultado listo», no se revisaba RN-08 y no se podía descargar el PDF | El sílabo pasa a ser obligatorio al registrar la materia; si igual llega sin sílabo, el agente la marca «Sin materia equivalente». El manual de usuario lo aclara | Corregido |
| E-7 | CP-32, CP-33 | Cada clic en **«Reintentar las pendientes»** lanza otra revisión completa en paralelo; llegaron a correr 5 a la vez y saturaron a Gemini, por eso la evaluación tardó unos 15 minutos | Al reintentar, las materias pasan a «En revisión» y el botón desaparece hasta que el agente responda; mientras se envía el pedido el botón queda desactivado. Si llegan dos clics a la vez, solo uno lanza la revisión | Corregido |
| E-8 | CP-36 | El PDF muestra el correo del estudiante en lugar de su nombre, y la carrera de destino como «SW» en lugar de «Software» | El informe muestra el nombre completo del estudiante (en una línea, achicando la letra si es largo) y el nombre de las carreras. Una sesión abierta antes del cambio sigue mostrando el correo hasta volver a iniciar sesión | Corregido |
| E-9 | CP-29 | Al abrir «Tus materias aprobadas» aparecía un instante el formulario de la UTA antes del de otra universidad | La página muestra «Cargando…» hasta tener la solicitud | Corregido |

## HU-26 y HU-29 · materias divididas en partes

> **Actualización 22/11/2026:** en la revisión el docente indicó que una materia aprobada **no** puede homologar dos materias nuevas («caso contrario no»). Se quitó HU-29; CP-38 queda como registro de lo probado y ya no aplica. HU-26 (Física I + Física II → Física) se mantiene.

Prueba en la PC de Diana el 19/11/2026, rama `feature/HU-26-HU-29`, solicitud **3003** de otra universidad (Universidad del Pacífico Andino, institución ficticia → Software). Se usaron sílabos de prueba: Física I y Física II (cada una con la mitad de los temas de FÍSICA de Software) y un Cálculo anual (temas de Cálculo Diferencial y de Cálculo Integral).

| # | HU | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|---|
| CP-37 | HU-26 | Dos materias para una | Registrar Física I (3 cr, 144 h, 16/20, 2024) y Física II (3 cr, 144 h, 15/20, 2025) y enviar | Se evalúan juntas frente a FÍSICA | Una fila «Evaluadas juntas · Física I + Física II» → **FÍSICA, Homologable**. RN-01 contenidos 100 % de las dos juntas; RN-02 créditos sumados 6 de 3; RN-03 horas sumadas 288 de 144; RN-04 «Promedio 7,8/10 según créditos (Física I 16/20 y Física II 15/20)»; RN-05 se toma la más antigua (2024) ([captura](evidencias/CP-37-juntas.jpg)) | OK |
| CP-38 | HU-29 | Una materia para dos | Registrar Cálculo (8 cr, 320 h, 17/20, 2025) | Se evalúa con cada materia que cubre | **CÁLCULO DIFERENCIAL, Homologable** (parecido 95 %) y una fila «También cubre» **CÁLCULO INTEGRAL, Homologable** (95 %) ([captura](evidencias/CP-38-tambien-cubre.jpg)) | OK |
| CP-39 | HU-26 / HU-29 | RN-08 cuenta materias de la nueva carrera | Al terminar | Las dos Físicas cuentan como una y Cálculo como dos | «Tiene 3 materias homologables (mínimo 2)»: FÍSICA, Cálculo Diferencial y Cálculo Integral | OK |
| CP-40 | HU-26 / HU-29 | Informe PDF | Descargar el informe | Mismas filas que en la página | 200, 2 páginas: «Física I + Física II · Evaluadas juntas» y «También cubre · Cálculo» con sus reglas | OK |

El agente terminó en unos 4 minutos. Los casos de una sola parte («Física I» sola: aviso de que falta la otra) y de la UTA («FISICA» frente a «FISICA I» y «FISICA II») están cubiertos con pruebas automáticas, porque las mallas de TI y Software no tienen materias divididas en partes.

## Observaciones de la revisión del 22/11/2026

Prueba en la PC de Diana el 22/11/2026, rama `feature/HU-26-HU-29`, con todos los servicios reconstruidos.

| # | Observación | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|---|
| CP-41 | «Caso contrario no» | Una materia no homologa dos | Pruebas automáticas: «FISICA» frente a «FISICA I» y «FISICA II» | Sin materia equivalente; nunca dos resultados para una materia | Sin materia equivalente; HU-29 quitada del agente, la página y el PDF | OK |
| CP-42 | Récord y «no meter todo a mano» | Leer el récord con IA | `POST /api/agente/leer-record` con el récord de prueba | Lista con nota, escala, año, créditos, horas y estado | 10 materias leídas en 28 s, todas con nota, escala, año, créditos, horas y estado «Aprobada» (el récord de prueba no tenía reprobadas) | OK |
| CP-43 | Dos docentes en un mismo informe | Revisión de la solicitud 3004 | El administrador crea dos docentes; el docente 1 cambia «Fisica» de No homologable a Homologable sin comentario y luego con comentario; aprueba dos veces; el docente 2 aprueba; luego intenta cambiar | Sin comentario se rechaza; no aprueba dos veces; con dos aprobaciones queda REVISADA y ya no se cambia | 400 «Explica en un comentario…»; cambio guardado; 400 «Ya aprobaste este informe»; 2 de 2 → **REVISADA**; 400 «ya fue aprobado por dos docentes». El estudiante ve el resultado final y los dos docentes; el PDF (estudiante y docente) muestra «Cambiado por…» y «Revisado por dos docentes» ([captura](evidencias/CP-43-revision-docente.jpg)) | OK |
| CP-44 | Permisos | Estudiante en rutas de docentes y administrador | Crear docente y ver la revisión con la cuenta de un estudiante | 403 | 403 y 403 | OK |

> **Actualización 23/11/2026:** el equipo definió que trabajan **un coordinador y un docente**: el coordinador elige al docente y el docente hace la homologación. La aprobación de dos docentes (CP-43) se reemplazó por ese flujo.

## Coordinador y docente (23/11/2026)

Prueba en la PC de Diana, rama `feature/HU-26-HU-29`, todos los servicios reconstruidos, con la solicitud **3003** (otra universidad: Física I + Física II y Cálculo).

| # | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|
| CP-45 | Cuentas | El administrador crea un coordinador de prueba | Se crea con rol COORDINADOR y ve la lista de docentes | 201; la lista muestra al coordinador y a los dos docentes | OK |
| CP-46 | Asignar y cambiar docente | El coordinador asigna el docente 2 y luego lo cambia por el docente 1 | El estudiante ve quién revisa; el docente 2 ya no la ve | 200 y 200; el estudiante vio «Docente Prueba Dos» y luego «Docente Prueba Uno»; el docente 2 recibe 403 | OK |
| CP-47 | El docente homologa | El docente 1 cambia Cálculo a No homologable con comentario; cambia Física I (se aplica también a Física II) y la devuelve al resultado del agente; termina con comentario | Cambios guardados; el grupo cambia junto; RN-08 se vuelve a revisar; queda REVISADA y ya no se cambia | Física I y II cambiaron juntas; resultado final: Cálculo No homologable, Física I y II Homologable; RN-08 «1 materia homologable»; REVISADA; cambiar o reasignar después → 400 | OK |
| CP-48 | PDF y permisos | Descargar el informe como estudiante, docente 1, coordinador y docente 2; entrar a las rutas de otros roles | Estudiante, docente asignado y coordinador sí; el otro docente no; roles cruzados 403 | 200, 200, 200 y 403; el PDF dice «Homologación hecha por Ing. Docente Prueba Uno», «Docente asignado por Ing. Coordinador Prueba» y el comentario final; estudiante, docente y coordinador en rutas ajenas → 403 | OK |

> **Actualización 23/11/2026 (2):** el estudiante ya no usa el sistema. El coordinador registra la solicitud y asigna el docente; el docente sube el expediente, registra las materias, las envía al agente, revisa el análisis y envía el resultado al coordinador.


## Observaciones del ingeniero (24/11/2026)

Pruebas automáticas en la rama `feature/mejoras-ing`. La prueba en la PC de Diana se anota abajo cuando se reconstruyan los servicios.

| # | Observación | Caso | Pasos | Esperado | Obtenido | OK |
|---|---|---|---|---|---|---|
| CP-49 | Planes por URL o ruta | Importar una carpeta | `POST /api/catalogo/planes/importar-ruta {ruta: "planes/SW"}` y `"planes/TI"` | Se importan todos los PDF de la carpeta | 40 de 40 (SW) y 40 de 40 (TI) con los planes del repositorio | OK |
| CP-50 | Planes por URL o ruta | Carpeta de GitHub, página con enlaces, PDF suelto | Pruebas automáticas con respuestas simuladas | Se listan solo los PDF; un archivo dañado no detiene a los demás; rutas fuera de «planes» se rechazan | Como se esperaba | OK |
| CP-51 | Planes con otro formato | PDF que no es de la FISEI | Sin carrera, y con carrera «RO» | Sin carrera pide indicarla; con carrera la IA arma la fila (código `RO-…`, unidades numeradas) | Como se esperaba | OK |
| CP-52 | Matriz por carrera | `GET /api/catalogo/matriz?carrera=SW` y botón **Ver matriz** | Materia, nivel, unidades, créditos y horas en orden de malla; descarga en CSV | Como se esperaba; el agente ahora pide la matriz en una sola consulta en vez de materia por materia | OK |
| CP-53 | Comparar contra la matriz | Materia de otra universidad **sin sílabo** | Registrar «Cálculo II» sin sílabo y enviar | Se acepta; el agente compara por el nombre contra la matriz y deja el aviso «Sin sílabo…» | Como se esperaba (pruebas automáticas) | OK |
| CP-54 | «Sí puede homologar» no dejaba avanzar | Docente cambia «Sin materia equivalente» a Homologable | Sin comentario, sin materia elegida, y luego completo | Mensaje claro de lo que falta; con materia elegida y comentario se guarda | «Para guardar falta: …»; se guarda con la materia elegida y aparece en el PDF «(elegida por el docente)» | OK |
| CP-55 | Inconsistencias | Homologable sin cumplir reglas / No homologable cumpliendo todas | Guardar sin confirmar y luego confirmando | Sin confirmar → 400 con la regla incumplida; confirmando se guarda | Como se esperaba | OK |
| CP-56 | Fundamentos de Programación (TI) → Algoritmos y Lógica de Programación (SW) | Estudiante UTA de TI a SW | Pruebas automáticas: nombres distintos, mismos temas | El agente busca por temas en la matriz y los compara | Se elige la materia por temas y se evalúa sola | OK |
| CP-57 | Dos estudiantes con el mismo nombre | Cédula o pasaporte | Registrar «Juanito Pérez» sin cédula, con cédula inválida, con la cédula de una solicitud en trámite y con otra cédula | Pide la cédula; rechaza la inválida; avisa «Ya hay una solicitud en trámite… N.º»; con otra cédula se registra; la cédula sale en listas, buscador y PDF | Como se esperaba (pruebas automáticas y capturas) | OK |
