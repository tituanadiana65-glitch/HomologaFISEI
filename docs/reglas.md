# Reglas de homologación de la FISEI

Reglas que aplica HomologaFISEI para decidir si una materia aprobada se homologa por una materia de la nueva carrera. Los valores numéricos se cargan en `reglas_db` con `ms-motor-reglas/prisma/seed.ts`.

> **Pendiente de verificar:** la columna *Base* viene del documento de planificación. Antes de pasarle este archivo a José, confirma cada valor y el artículo exacto contra la **R CAU P 122-2026** (art. 15, 19 y 20) y la reforma **CAU-P-011-2026** del instructivo de cambios de carrera. Si la normativa dice algo distinto, corrige aquí y en el `seed.ts`.

## Resumen

| Código | Regla | Valor | Base | Quién la aplica | Sprint |
|---|---|---|---|---|---|
| RN-01 | Coincidencia de contenidos y resultados de aprendizaje | mínimo 80 % | CAU-P-122-2026, art. 20 | Agente IA | 1 |
| RN-02 | Créditos de la materia aprobada frente a la nueva | mínimo 80 % | Criterio visto en clase | Motor de reglas | 1 |
| RN-03 | Horas de la materia aprobada frente a la nueva | mínimo 80 % | Instructivo de cambios de carrera | Motor de reglas | 1 |
| RN-04 | Nota de aprobación | mínimo 7/10 | Historial académico | Motor de reglas | 1 |
| RN-05 | Tiempo desde que se aprobó | máximo 10 años | Instructivo de cambios de carrera | Motor de reglas | 1 |
| RN-06 | Prerrequisitos de la materia nueva | se informan | Malla de la carrera | Motor de reglas | 2 |
| RN-07 | Cambio interno: 1 periodo y 1 materia homologable, sin tercera matrícula | — | Instructivo, sección D | Solicitudes | 2 |
| RN-08 | Desde otra universidad: 2 periodos y 2 materias, documentos legalizados | — | Instructivo, sección E | Solicitudes | 2 |
| RN-09 | Comparar con lo visto en el paralelo; si no hay sílabo, con el plan oficial | — | Propia del proyecto | Agente IA | 2 |
| RN-10 | Dos materias aprobadas pueden cubrir juntas una nueva | mínimo 80 % | Ejemplo visto en clase | Agente IA | 2 |
| RN-11 | Cada resultado explica qué regla se cumplió o no | — | CAU-P-122-2026, art. 15 | Todos | 1 |

Una materia es **homologable** solo si cumple todas las reglas del sprint que le aplican. Si falla una, el resultado es **No homologable** y RN-11 dice cuál falló.

## Detalle y ejemplos

### RN-01 · Coincidencia de contenidos (mínimo 80 %)
El Agente IA compara las unidades y resultados de aprendizaje de la materia aprobada con los de la nueva. Si coinciden en al menos el 80 %, cumple.

*Ejemplo:* Cálculo Integral de TI frente a Cálculo Integral de Software: los temas de las cuatro unidades coinciden (integral indefinida, definida, técnicas de integración, aplicaciones). Cumple RN-01. Aun así la materia puede salir No homologable por otra regla (ver RN-02).

### RN-02 · Créditos (mínimo 80 %)
`créditos aprobada / créditos nueva ≥ 0,80`

*Ejemplo:* Cálculo Integral de TI tiene 2 créditos y la de Software 3. 2 / 3 = 66,66 %. **No cumple.** Es el caso clave de la demo: sale No homologable aunque los temas coincidan.

### RN-03 · Horas (mínimo 80 %)
`horas aprobada / horas nueva ≥ 0,80`

*Ejemplo:* Cálculo Integral de TI tiene 96 horas. Si la de Software tiene 144 horas (3 créditos × 48 h), 96 / 144 = 66,66 %. **No cumple.** (Confirmar las horas de Software con su plan analítico.)

### RN-04 · Nota de aprobación (mínimo 7/10)
*Ejemplo:* aprobó Física con 7,0 → cumple. Con 6,9 → no cumple.

### RN-05 · Tiempo desde la aprobación (máximo 10 años)
`año actual − año de aprobación ≤ 10`

*Ejemplo:* en 2026, una materia aprobada en 2018 tiene 8 años → cumple. Una aprobada en 2015 tiene 11 años → no cumple.

### RN-06 · Prerrequisitos de la materia nueva (se informan)
No bloquea la homologación: el resultado avisa qué prerrequisitos y correquisitos tiene la materia nueva (tabla `Requisito`, tipo `PRE` o `CO`) para que el estudiante sepa qué le falta.

*Ejemplo:* si la materia nueva tiene como prerrequisito Cálculo Diferencial, el resultado lo muestra junto a la decisión.

### RN-07 · Cambio de carrera interno
El estudiante debe haber aprobado al menos 1 periodo y tener al menos 1 materia homologable, y no puede estar en tercera matrícula.

*Ejemplo:* un estudiante de TI con primer semestre aprobado pide cambio a Software y le homologan Física → procede. Si está en tercera matrícula de alguna materia → no procede.

### RN-08 · Desde otra universidad
El estudiante debe haber aprobado al menos 2 periodos y tener al menos 2 materias homologables, con los documentos (récord académico y planes analíticos) legalizados.

*Ejemplo:* viene de otra universidad con 2 semestres aprobados, 3 materias homologables y documentos legalizados → procede. Con documentos sin legalizar → no procede.

### RN-09 · Fuente de comparación
Se compara con lo que realmente se vio en el paralelo (sílabo del docente). Si no hay sílabo, se usa el plan analítico oficial guardado en `catalogo_db`.

*Ejemplo:* el estudiante no adjunta sílabo de Estructura de Datos → el Agente IA compara con el plan oficial de TI.

### RN-10 · Dos materias cubren una nueva (mínimo 80 %)
Dos materias aprobadas pueden sumar sus contenidos, créditos y horas para cubrir una materia nueva. La suma debe cumplir el 80 % en RN-01, RN-02 y RN-03.

*Ejemplo:* dos materias de 2 créditos cada una (4 en total) frente a una nueva de 4 créditos: 4 / 4 = 100 % en créditos. Si juntas cubren el 85 % de los contenidos, cumple.

### RN-11 · Explicación del resultado
Cada resultado lista cada regla evaluada, si se cumplió y por qué.

*Ejemplo de salida:*

```json
{
  "materia": "Cálculo Integral (TI) → Cálculo Integral (SW)",
  "resultado": "No homologable",
  "reglas": [
    { "codigo": "RN-01", "cumple": true,  "detalle": "Contenidos coinciden en 90 % (mínimo 80 %)" },
    { "codigo": "RN-02", "cumple": false, "detalle": "Créditos 2/3 = 66,66 % (mínimo 80 %)" },
    { "codigo": "RN-03", "cumple": false, "detalle": "Horas 96/144 = 66,66 % (mínimo 80 %)" }
  ]
}
```

## Criterio de aceptación para la demo (21/10)
Cálculo Integral de TI (2 créditos) frente a la de Software (3 créditos) sale **No homologable** por 66,66 % de créditos, aunque los temas coincidan.
