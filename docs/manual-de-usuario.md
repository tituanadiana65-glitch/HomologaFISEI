# Manual de usuario · HomologaFISEI

HomologaFISEI ayuda a la FISEI a analizar las solicitudes de homologación. El estudiante entrega su solicitud y sus documentos en la facultad; en el sistema trabajan el **coordinador** y los **docentes**:

1. El **coordinador** registra la solicitud del estudiante y elige el **docente** que hará la homologación.
2. El **docente** sube el expediente (récord, malla, sílabos), registra las materias aprobadas y las envía al **agente**.
3. El **agente** (inteligencia artificial + reglas) analiza cada materia.
4. El **docente** revisa el análisis, lo corrige si hace falta y **envía al coordinador** lo homologable y lo no homologable.
5. El **coordinador** recibe el resultado y descarga el informe en PDF.

> **Importante:** el resultado es un **análisis previo**. La decisión oficial la toma el **Consejo Directivo de la Facultad**.

**Contenido**

1. [Entrar al sistema](#1-entrar-al-sistema)
2. [Coordinador](#2-coordinador)
3. [Docente](#3-docente)
4. [Cómo leer el resultado](#4-cómo-leer-el-resultado)
5. [Administrador](#5-administrador)
6. [Preguntas frecuentes](#6-preguntas-frecuentes)

---

## 1. Entrar al sistema

Abre la dirección de HomologaFISEI en tu navegador (en la computadora del equipo: http://localhost:5173). Escribe tu correo institucional y la contraseña que te entregó el administrador y pulsa **Entrar**. El sistema te lleva a tu pantalla según tu rol. Tu sesión dura 8 horas; para salir, pulsa **Salir** arriba a la derecha.

---

## 2. Coordinador

### Registrar una solicitud

1. En **Coordinación de homologaciones**, pulsa **+ Registrar solicitud**.
2. Elige si el estudiante es **de la UTA** (se cambia entre carreras de la FISEI) o **viene de otra universidad**.
3. Escribe el **nombre del estudiante** y su **cédula** (o su **pasaporte**, si es extranjero). El sistema revisa que la cédula sea válida y no deja registrar dos solicitudes en trámite del mismo estudiante para la misma carrera. Luego escribe la carrera (y universidad) de origen, la **carrera de destino** y el **periodo**. Si viene de otra universidad, indica también sus **periodos aprobados** y si sus documentos están **legalizados**.
4. Elige el **docente que hará la homologación** (o déjalo para después) y pulsa **Registrar solicitud**.

### Asignar o cambiar el docente

Para encontrar una solicitud, escribe en el buscador el **nombre**, la **cédula** o el **número** (si dos estudiantes se llaman igual, se distinguen por la cédula). Las solicitudes están en tres grupos: **Sin docente**, **En homologación** y **Recibidas**. En cada solicitud sin docente, elige el docente y pulsa **Asignar**. Mientras el docente no te envíe el resultado, puedes cambiarlo con **Cambiar**. En la columna **Docente** ves en qué va: el docente sube el expediente, el agente está analizando o el docente revisa el análisis.

### Recibir el resultado

Cuando el docente envía el resultado, la solicitud pasa a **Recibidas**. Pulsa **Ver** para ver cada materia con su resultado y **PDF** para descargar el informe.

---

## 3. Docente

En **Mis homologaciones** están solo las solicitudes que te asignó el coordinador, con su etapa. Pulsa **Abrir**.

### Paso 1 · Expediente y materias

1. En **Expediente del estudiante**, sube en PDF (con texto, no escaneado) el **récord académico**. Si viene de otra universidad, sube también la **malla curricular** y revisa los **periodos aprobados** y si los documentos están **legalizados**.
2. **Lo más rápido: llena las materias desde el récord.** Pulsa **Leer el récord**: la inteligencia artificial arma la lista de materias que cursó, con las **aprobadas** y las **reprobadas** (las reprobadas no se pueden homologar). Marca las que quieras, revisa créditos y horas y, si viene de otra universidad, sube el **sílabo** de cada una si lo tienes (es opcional). Pulsa **Agregar**.
3. También puedes agregarlas **a mano**:
   - **Estudiante de la UTA:** elige el **Nivel** y la **Materia**, y completa paralelo, docente, periodo, año, nota (de 0 a 10) y matrícula.
   - **De otra universidad:** escribe el nombre tal como aparece en el récord, créditos, horas, la nota y sobre cuánto califica su universidad (10, 20 o 100: el sistema la convierte a la escala de la UTA), el año y, si lo tienes, sube el **sílabo** (opcional). Sin sílabo, el agente compara la materia por su nombre contra la matriz de la carrera y te muestra el aviso «Sin sílabo…» para que la revises con más cuidado.
4. Cuando estén todas, pulsa **Enviar al agente**. Después ya no se pueden cambiar las materias.

### Paso 2 · Análisis del agente

Verás cuánto tiempo lleva el agente revisando y qué está haciendo. Suele tardar unos minutos; la página se actualiza sola. Si alguna materia queda **Pendiente**, pulsa **Reintentar las pendientes** (una sola vez).

### Paso 3 · Revisión y envío al coordinador

1. Verás cada materia con el resultado del **agente** y el **resultado final**. Pulsa **Ver por qué** para ver las reglas.
2. Si no estás de acuerdo con una materia, pulsa **Cambiar**, elige el nuevo resultado y escribe un **comentario** de al menos 5 letras. Si el botón **Guardar** no se activa, debajo dice qué falta.
   - Si la cambias a **Homologable** y el agente no encontró materia equivalente, elige en **Se homologa por** la materia de la nueva carrera.
   - Si tu cambio contradice las reglas (por ejemplo, la marcas Homologable pero no cumple RN-02), el sistema te lo dice y te pide **confirmarlo** con una casilla. Así no se homologa algo «no homologable» por error, ni al revés.
3. Cuando todo esté bien, pulsa **Enviar al coordinador** (puedes dejar un comentario). Después ya no se puede cambiar.

---

## 4. Cómo leer el resultado

Arriba hay una frase con **cuántas materias de la nueva carrera se le podrían reconocer** y un resumen con cuántas salieron en cada estado. Para cada materia se ve la **materia aprobada**, por cuál **se homologa** y el **resultado**:

| Resultado | Qué significa |
|---|---|
| **Homologable** | Cumple todas las reglas. Se le podría reconocer. |
| **No homologable** | No cumple al menos una regla. El detalle dice cuál. |
| **Pendiente** | La inteligencia artificial no alcanzó a revisarla. Pulsa **Reintentar las pendientes**. |
| **Sin materia equivalente** | No hay una materia igual o parecida en la nueva carrera. |

| Regla | Qué revisa |
|---|---|
| RN-01 | Los temas coinciden al menos en 80 % |
| RN-02 | Los créditos son al menos el 80 % de los de la materia nueva |
| RN-03 | Las horas son al menos el 80 % de las de la materia nueva |
| RN-04 | La nota es de al menos 7 sobre 10 |
| RN-05 | No han pasado más de 10 años desde que la aprobó |
| RN-08 | De otra universidad: al menos 2 periodos aprobados, 2 materias homologables y documentos legalizados |

### Materias divididas en partes

- **Varias materias aprobadas para una nueva.** Si el estudiante aprobó, por ejemplo, «Física I» y «Física II» y la nueva carrera tiene una sola «Física», el agente las revisa **juntas** (suma créditos y horas, une los temas y promedia las notas según sus créditos). Aparecen en una sola fila con la etiqueta **Evaluadas juntas**. Registra todas las partes.
- **Una materia aprobada no cubre dos nuevas.** Si la nueva carrera divide una materia (Física I y Física II), la materia aprobada solo puede homologar una de ellas o ninguna.
- Si se registró solo una parte, el detalle avisa que falta la otra.

### El informe en PDF

Trae los datos del estudiante, las carreras, la fecha, el resumen, RN-08 (otra universidad) y, por cada materia, el resultado con sus reglas, los cambios del docente con su comentario, qué docente hizo la homologación y quién lo asignó.

---

## 5. Administrador

El administrador prepara el sistema: carreras, planes analíticos y reglas. Entra con la cuenta de administrador que le entrega el equipo. Al iniciar sesión va directo a la pantalla **Administración**. El coordinador y los docentes no pueden entrar a esta pantalla.

### Ver y agregar carreras

- En **Carreras y planes analíticos** está la lista de carreras con el número de materias de cada una.
- Para registrar una carrera nueva, en **Nueva carrera** escribe su **código** (por ejemplo, `IN`) y su **nombre**, y pulsa **Crear carrera**.

### Importar planes analíticos

Hay dos formas; elige la pestaña:

- **Subir archivos:** elige uno o varios PDF y pulsa **Importar plan**.
- **Desde URL o carpeta:** escribe dónde están los planes y pulsa **Traer e importar**. El sistema trae todos los PDF de una vez (hasta 80). Sirve:
  - una carpeta de GitHub, por ejemplo `https://github.com/tituanadiana65-glitch/HomologaFISEI/tree/main/planes/SW`;
  - una página web con enlaces a los PDF, o la dirección de un solo PDF;
  - una carpeta dentro de la carpeta `planes` del proyecto, por ejemplo `planes/SW` o `planes/TI`.

  Al terminar verás la lista de planes importados y, si alguno falló, el motivo.

El sistema lee del PDF el nombre, el nivel, los créditos, las horas, las unidades y los prerrequisitos. Si el plan es de una carrera nueva, la carrera se crea sola. Si importas dos veces el mismo plan, la materia no se repite.

**Planes con otro formato:** si los PDF no tienen el formato de los planes de la FISEI, elige la **Carrera** antes de importar. La inteligencia artificial los lee y los convierte a la matriz (aparecen como «leído con IA»).

### Ver la matriz de una carrera

En la lista de carreras, pulsa **Ver matriz**. Verás cada materia con su **nivel**, sus **contenidos o unidades**, sus **créditos** y sus **horas**. El agente compara las materias aprobadas del récord contra esta matriz, sin volver a abrir los PDF. Pulsa **Descargar CSV (Excel)** para tenerla en una hoja de cálculo.

### Cambiar las reglas

En **Reglas de homologación** están los valores que se aplican a todas las carreras: 80 % de contenidos, créditos y horas, nota mínima 7 sobre 10 y máximo 10 años.

1. Cambia el valor (por ejemplo, la nota mínima de 7 a 8).
2. Pulsa **Guardar**. Desde ese momento todas las homologaciones usan el valor nuevo.
3. Si una regla no se debe aplicar, pulsa **Desactivar**. Para volver a aplicarla, pulsa **Activar**.

### Crear las cuentas del coordinador y los docentes

En **Coordinador y docentes**, elige el **Rol** (Docente o Coordinador), escribe el **nombre**, el **correo institucional** y una **contraseña inicial** (al menos 8 caracteres) y pulsa **Crear cuenta**. Entrega el correo y la contraseña a la persona.


---

## 6. Preguntas frecuentes

**El estudiante quiere ver su resultado.**
El estudiante no entra al sistema. El coordinador le entrega el informe en PDF.

**Las materias quedaron «Pendiente».**
La inteligencia artificial estaba ocupada o no respondió. Espera un momento y pulsa **Reintentar las pendientes** una sola vez.

**El resultado tarda mucho.**
El agente revisa materia por materia y espera a la inteligencia artificial. Con varias materias puede tardar unos minutos. La página se actualiza sola.

**Dice «El PDF no tiene texto».**
El archivo es una imagen escaneada. Pide el documento en PDF con texto (que se pueda seleccionar y copiar) y vuelve a subirlo.

**No encuentro la materia en la lista (estudiante de la UTA).**
La lista solo muestra las materias de la carrera de origen y del nivel elegido. Revisa el nivel.

**¿El resultado ya es oficial?**
No. Es un análisis previo. La decisión oficial la toma el Consejo Directivo de la Facultad.
