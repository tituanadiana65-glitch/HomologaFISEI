// T08 · Carga todos los planes analíticos (PDF) en el catálogo a través del API Gateway.
// Uso:  node scripts/cargar-planes.mjs
//       node scripts/cargar-planes.mjs "C:/ruta/planes TI" "C:/ruta/planes SW"
// Sin rutas, usa la carpeta planes/ del proyecto o, si no está, las carpetas de Descargas
// PlanesAnaliticos_TI_Jul26_Dec26 y PlanesAnaliticos_SW_Jul26_Dec26.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';

const GATEWAY = process.env.GATEWAY ?? 'http://localhost:3000';
const descargas = join(homedir(), 'Downloads');
// Primero la carpeta "planes" del proyecto (viene en el .zip); si no existe, las carpetas de Descargas
const delProyecto = join(import.meta.dirname ?? '.', '..', 'planes');
const porDefecto = existsSync(delProyecto)
  ? [delProyecto]
  : ['PlanesAnaliticos_TI_Jul26_Dec26', 'PlanesAnaliticos_SW_Jul26_Dec26'].map((c) => join(descargas, c));
const carpetas = process.argv.length > 2 ? process.argv.slice(2) : porDefecto;

// Busca PDF dentro de la carpeta y sus subcarpetas (los planes vienen en "PLAN ANALÍTICO")
function pdfs(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((n) => {
    const ruta = join(dir, n);
    if (statSync(ruta).isDirectory()) return pdfs(ruta);
    return n.toLowerCase().endsWith('.pdf') ? [ruta] : [];
  });
}

const archivos = carpetas.flatMap(pdfs);
if (!archivos.length) {
  console.log('No se encontraron PDF en:\n  ' + carpetas.join('\n  '));
  console.log('Pasa las carpetas como argumentos: node scripts/cargar-planes.mjs "C:/ruta/TI" "C:/ruta/SW"');
  process.exit(1);
}

let ok = 0;
const fallos = [];
for (const ruta of archivos) {
  const form = new FormData();
  form.append('archivo', new Blob([readFileSync(ruta)], { type: 'application/pdf' }), basename(ruta));
  try {
    const r = await fetch(`${GATEWAY}/api/catalogo/planes/importar`, { method: 'POST', body: form });
    const datos = await r.json();
    if (!r.ok) throw new Error(datos.message ?? r.status);
    ok++;
    console.log(`✓ ${datos.carrera}  ${datos.nombre}  (${datos.creditos} cr, ${datos.horasTotales} h)`);
  } catch (e) {
    fallos.push(basename(ruta));
    console.log(`✗ ${basename(ruta)}: ${e.message}`);
  }
}
console.log(`\nCargados: ${ok} · Con error: ${fallos.length}`);
process.exit(fallos.length ? 1 : 0);
