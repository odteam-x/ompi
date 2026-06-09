// =========================================================
//  OMPI · Portal Documental — generador de manifest.json (Node)
// ---------------------------------------------------------
//  Alternativa multiplataforma al script PowerShell.
//
//  Uso (desde la carpeta "site/"):
//     node generate-manifest.mjs
//
//  Opciones por entorno:
//     OMPI_SOURCE   carpeta a indexar (default: ..)
//     OMPI_OUT      ruta de salida    (default: ./manifest.json)
// =========================================================

import { readdir, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SOURCE = resolve(process.env.OMPI_SOURCE || join(__dirname, '..'));
const OUT    = resolve(process.env.OMPI_OUT    || join(__dirname, 'manifest.json'));
const SITE   = resolve(__dirname);

async function scan(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  // Carpetas primero, luego archivos; ambos por nombre (es).
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });

  const items = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (full === SITE) continue;            // no indexar el propio sitio
    if (entry.name.startsWith('.')) continue;

    if (entry.isDirectory()) {
      items.push({
        type: 'dir',
        name: entry.name,
        children: await scan(full),
      });
    } else if (entry.isFile()) {
      const st = await stat(full);
      const rel = relative(SOURCE, full).split(sep).join('/');
      const ext = (entry.name.split('.').pop() || '').toLowerCase();
      items.push({
        type: 'file',
        name: entry.name,
        path: rel,
        ext,
        size: st.size,
        modified: st.mtime.toISOString().replace(/\.\d+Z$/, 'Z'),
      });
    }
  }
  return items;
}

const items = await scan(SOURCE);
const manifest = {
  generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  root: '..',
  items,
};

await writeFile(OUT, JSON.stringify(manifest, null, 2), 'utf8');
console.log('Manifest generado:', OUT);
console.log('Total entradas raíz:', items.length);
