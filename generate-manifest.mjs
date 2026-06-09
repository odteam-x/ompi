// =========================================================
//  OMPI · Modelos Regionales ONU — generador de manifest.json (Node)
// ---------------------------------------------------------
//  Alternativa multiplataforma al script PowerShell.
//
//  Uso (desde la carpeta del proyecto):
//     node generate-manifest.mjs
//
//  Opciones por entorno:
//     OMPI_SOURCE   carpeta a indexar (default: carpeta del script)
//     OMPI_OUT      ruta de salida    (default: ./manifest.json)
// =========================================================

import { readdir, stat, readFile, writeFile, access } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SOURCE = resolve(process.env.OMPI_SOURCE || __dirname);
const OUT    = resolve(process.env.OMPI_OUT    || join(__dirname, 'manifest.json'));

// Archivos del propio sitio que NO se indexan.
const EXCLUDE = new Set([
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'README.md',
  'generate-manifest.ps1',
  'generate-manifest.mjs',
  'isotipo.png',
  'mr.png',
]);

async function scan(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
  });

  const items = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    if (entry.isFile() && EXCLUDE.has(entry.name)) continue;

    const full = join(dir, entry.name);
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

// Conservar descripciones y tags del manifest previo (datos curados).
async function loadPrevMeta(path) {
  const desc = new Map();
  const tags = new Map();
  try {
    await access(path);
    const prev = JSON.parse(await readFile(path, 'utf8'));
    const walk = (arr) => {
      for (const e of arr) {
        if (e.type === 'dir' && Array.isArray(e.children)) walk(e.children);
        else if (e.type === 'file' && e.path) {
          if (e.description) desc.set(e.path, e.description);
          if (Array.isArray(e.tags) && e.tags.length) tags.set(e.path, e.tags);
        }
      }
    };
    walk(prev.items || []);
  } catch { /* no hay manifest previo: ok */ }
  return { desc, tags };
}

function hydrate(entries, desc, tags) {
  for (const e of entries) {
    if (e.type === 'dir') hydrate(e.children, desc, tags);
    else if (e.type === 'file') {
      if (desc.has(e.path)) e.description = desc.get(e.path);
      if (tags.has(e.path)) e.tags        = tags.get(e.path);
    }
  }
}

const { desc, tags } = await loadPrevMeta(OUT);
const items = await scan(SOURCE);
hydrate(items, desc, tags);

const manifest = {
  generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  root: '.',
  items,
};

await writeFile(OUT, JSON.stringify(manifest, null, 2), 'utf8');
console.log('Manifest generado:', OUT);
console.log('Total entradas raíz:', items.length);
