# Pruebas del Sprint 1 (T13)

Casos con materias reales de TI y Software. Se corren con el sistema levantado (`docker compose up -d --build`), los 80 planes cargados y la clave de Gemini (`IA_API_KEY`) en `.env`. Llenar la columna **Obtenido** y adjuntar capturas en la carpeta de evidencias.

Códigos útiles: Cálculo Integral TI `UTA-FISEI-TI-MP-UB-02-01` (2 cr, 96 h) · Cálculo Integral SW `UTA-FISEI-SF-MP-UB-02-02` (3 cr, 144 h) · Física TI `UTA-FISEI-TI-MP-UB-01-04` (3 cr, 144 h) · Física SW `UTA-FISEI-SF-MP-UB-01-01` (3 cr, 144 h).

| # | Caso | Datos | Esperado | Obtenido |
|---|---|---|---|---|
| 1 | Física TI → Física Software | nota 8.5, año 2025 | Homologable si los temas coinciden ≥ 80 % | |
| 2 | Cálculo Integral TI → Cálculo Integral Software | nota 8.5, año 2025 | No homologable por créditos 2 de 3 (66,66 %) y horas 96 de 144 | |
| 3 | Física TI → Estructura de Datos Software | nota 9, año 2025 | No homologable por contenidos (< 80 %) | |
| 4 | Física TI → Física Software | nota 6.5 | No homologable por nota (RN-04) | |
| 5 | Física TI → Física Software | año 2014 | No homologable por vigencia (RN-05) | |
| 6 | Caso 1 sin `IA_API_KEY` | dejar la clave vacía y reiniciar `ms-agente-ia` | Pendiente, con "falta el análisis de contenidos" | |
| 7 | Importar un PDF que no es plan analítico | cualquier otro PDF | Rechazado (error 400) con el motivo | |
| 8 | Importar dos veces el mismo plan | mismo PDF | La materia no se duplica | |
| 9 | Carga completa | `node scripts/cargar-planes.mjs` | 80 cargados, 0 con error | |
| 10 | Pruebas automáticas | `npm test` en cada servicio y CI en GitHub | Todas pasan, CI en verde | |

## Pruebas automáticas (TDD)

| Servicio | Pruebas | Qué cubren |
|---|---|---|
| ms-catalogo | 14 | Lector de PDF con planes reales TI y SW, horas de unidades, guardado sin duplicados, rechazo de archivos inválidos |
| ms-motor-reglas | 13 | RN-02 a RN-05, caso Cálculo Integral, valores leídos de reglas_db |
| ms-agente-ia | 18 | Comparación de contenidos (RN-01) con Gemini/Groq/Ollama, falla o límite de la IA, informe, flujo completo de homologación |
| api-gateway | 1 | Endpoint de salud |

El lector de PDF se verificó además con los 80 planes analíticos (40 TI y 40 SW): en todos, las horas de las unidades suman el total del plan.
