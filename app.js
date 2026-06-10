/* =========================================================
   OMPI · Modelos Regionales ONU — Acceso a Documentos
   ---------------------------------------------------------
     • indexer  → carga/normaliza manifest.json (docs + workshops)
     • model    → consultas (carpeta, búsqueda, archivo)
     • view     → render HTML (hero badge, talleres, docs, detalle)
     • router   → hash → vista
   ========================================================= */

(() => {
  'use strict';

  const MANIFEST_URL = 'manifest.json';

  const TYPE_MAP = {
    pdf:  { label: 'PDF',       cls: 'ic-pdf',  badge: 'pdf', preview: 'pdf'   },
    png:  { label: 'Imagen',    cls: 'ic-img',  badge: 'img', preview: 'image' },
    jpg:  { label: 'Imagen',    cls: 'ic-img',  badge: 'img', preview: 'image' },
    jpeg: { label: 'Imagen',    cls: 'ic-img',  badge: 'img', preview: 'image' },
    gif:  { label: 'Imagen',    cls: 'ic-img',  badge: 'img', preview: 'image' },
    svg:  { label: 'Imagen',    cls: 'ic-img',  badge: 'img', preview: 'image' },
    webp: { label: 'Imagen',    cls: 'ic-img',  badge: 'img', preview: 'image' },
    txt:  { label: 'Texto',     cls: 'ic-txt',  badge: 'txt', preview: 'text'  },
    md:   { label: 'Markdown',  cls: 'ic-txt',  badge: 'txt', preview: 'text'  },
    json: { label: 'JSON',      cls: 'ic-txt',  badge: 'txt', preview: 'text'  },
    csv:  { label: 'CSV',       cls: 'ic-txt',  badge: 'txt', preview: 'text'  },
    doc:  { label: 'Word',      cls: 'ic-doc',  badge: 'doc', preview: null    },
    docx: { label: 'Word',      cls: 'ic-doc',  badge: 'doc', preview: null    },
    xls:  { label: 'Excel',     cls: 'ic-doc',  badge: 'doc', preview: null    },
    xlsx: { label: 'Excel',     cls: 'ic-doc',  badge: 'doc', preview: null    },
    ppt:  { label: 'PowerPoint',cls: 'ic-doc',  badge: 'doc', preview: null    },
    pptx: { label: 'PowerPoint',cls: 'ic-doc',  badge: 'doc', preview: null    },
    zip:  { label: 'Archivo',   cls: 'ic-zip',  badge: 'doc', preview: null    },
    rar:  { label: 'Archivo',   cls: 'ic-zip',  badge: 'doc', preview: null    },
  };

  const TYPE_GROUPS = [
    { id: 'all',    label: 'Todos',     match: () => true },
    { id: 'pdf',    label: 'PDF',       match: (e) => e === 'pdf' },
    { id: 'image',  label: 'Imágenes',  match: (e) => ['png','jpg','jpeg','gif','svg','webp'].includes(e) },
    { id: 'doc',    label: 'Documentos',match: (e) => ['doc','docx','xls','xlsx','ppt','pptx'].includes(e) },
    { id: 'text',   label: 'Texto',     match: (e) => ['txt','md','json','csv'].includes(e) },
  ];

  /* ---------------------- Utilidades ---------------------- */
  const $  = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const escapeHtml = (s) => String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const formatBytes = (n) => {
    if (n == null || isNaN(n)) return '—';
    if (n < 1024) return `${n} B`;
    const u = ['KB','MB','GB','TB']; let i = -1; do { n /= 1024; i++; } while (n >= 1024 && i < u.length - 1);
    return `${n.toFixed(n < 10 ? 1 : 0)} ${u[i]}`;
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
  };

  const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  const typeInfo = (ext) => TYPE_MAP[(ext || '').toLowerCase()] || { label: (ext || '').toUpperCase() || 'FILE', cls: 'ic-default', badge: 'doc', preview: null };
  const encodePath = (p) => p.split('/').map(encodeURIComponent).join('/');

  const highlight = (text, query) => {
    if (!query) return escapeHtml(text);
    const nQ = normalize(query).trim();
    if (!nQ) return escapeHtml(text);
    const nT = normalize(text);
    const idx = nT.indexOf(nQ);
    if (idx < 0) return escapeHtml(text);
    const end = idx + nQ.length;
    return escapeHtml(text.slice(0, idx))
      + `<mark class="hl">${escapeHtml(text.slice(idx, end))}</mark>`
      + escapeHtml(text.slice(end));
  };

  /* ---------------------- Indexer ---------------------- */
  async function loadIndex() {
    const res = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(`No se pudo cargar manifest.json (${res.status})`);
    const data = await res.json();
    const root = data.root || '.';
    const workshops = Array.isArray(data.workshops) ? data.workshops : [];
    const flat = [];
    const tree = { name: '', path: '', type: 'dir', children: [] };

    const walkDir = (dirItem, parent, parentPath) => {
      const dir = {
        type: 'dir',
        name: dirItem.name,
        path: parentPath ? `${parentPath}/${dirItem.name}` : dirItem.name,
        children: [],
      };
      parent.children.push(dir);
      for (const child of dirItem.children || []) {
        if (child.type === 'dir' && Array.isArray(child.children)) walkDir(child, dir, dir.path);
        else walkFile(child, dir);
      }
    };

    const walkFile = (it, parent) => {
      const segments = it.path.split('/');
      const fileName = it.name || segments[segments.length - 1];
      let cursor = parent;
      // Si vive en subcarpetas y entra desde la raíz, construye el árbol intermedio
      if (parent === tree) {
        let accum = '';
        for (let i = 0; i < segments.length - 1; i++) {
          const seg = segments[i];
          accum = accum ? `${accum}/${seg}` : seg;
          let child = cursor.children.find((c) => c.type === 'dir' && c.name === seg);
          if (!child) {
            child = { type: 'dir', name: seg, path: accum, children: [] };
            cursor.children.push(child);
          }
          cursor = child;
        }
      }
      const entry = {
        type: 'file',
        name: fileName,
        path: it.path,
        ext: (it.ext || fileName.split('.').pop() || '').toLowerCase(),
        size: it.size,
        modified: it.modified,
        description: it.description || '',
        tags: Array.isArray(it.tags) ? it.tags : [],
      };
      cursor.children.push(entry);
      flat.push(entry);
    };

    for (const it of data.items || []) {
      if (it.type === 'dir' && Array.isArray(it.children)) walkDir(it, tree, '');
      else walkFile(it, tree);
    }

    return { root, tree, flat, workshops, generatedAt: data.generatedAt };
  }

  /* ---------------------- Modelo ---------------------- */
  function getDir(state, path) {
    if (!path) return state.tree;
    const parts = path.split('/').filter(Boolean);
    let cur = state.tree;
    for (const p of parts) {
      const next = cur.children.find((c) => c.type === 'dir' && c.name === p);
      if (!next) return null;
      cur = next;
    }
    return cur;
  }

  function getFile(state, path) {
    return state.flat.find((f) => f.path === path) || null;
  }

  function search(state, query, group) {
    const nQ = normalize(query).trim();
    const grp = TYPE_GROUPS.find((g) => g.id === group) || TYPE_GROUPS[0];
    return state.flat.filter((f) => {
      if (!grp.match(f.ext)) return false;
      if (!nQ) return true;
      const haystack = `${f.name} ${f.description} ${(f.tags || []).join(' ')}`;
      return normalize(haystack).includes(nQ);
    });
  }

  function countByGroup(state, source) {
    const arr = source || state.flat;
    const counts = {};
    for (const g of TYPE_GROUPS) {
      counts[g.id] = arr.filter((f) => f.type === 'file' && g.match(f.ext)).length;
    }
    counts.all = arr.length;
    return counts;
  }

  /* ---------------------- Iconos ---------------------- */
  const ICONS = {
    folder: `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/></svg>`,
    pdf: `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><text x="12" y="17" text-anchor="middle" font-family="'Barlow Condensed',Inter,Arial" font-size="5.2" font-weight="800" stroke="none" fill="currentColor">PDF</text></svg>`,
    img: `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m21 17-5-6-4 5-2-2-4 5"/></svg>`,
    doc: `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M9 13h6M9 17h6M9 9h2"/></svg>`,
    txt: `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/></svg>`,
    zip: `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/><path d="M11 7v2M11 11v2M11 15v2"/></svg>`,
    file: `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/></svg>`,
    download: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12"/><path d="m6 12 6 6 6-6"/><path d="M4 21h16"/></svg>`,
    external: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="m10 14 11-11"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>`,
    arrow: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7"/><path d="M8 7h9v9"/></svg>`,
    eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    grid: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
    list: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1.2" fill="currentColor"/><circle cx="4" cy="12" r="1.2" fill="currentColor"/><circle cx="4" cy="18" r="1.2" fill="currentColor"/></svg>`,
    inbox: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"/></svg>`,
    warn: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><path d="M12 9v4M12 17h.01"/></svg>`,
  };

  const iconForEntry = (entry) => {
    if (entry.type === 'dir') return { svg: ICONS.folder, cls: 'ic-folder' };
    const info = typeInfo(entry.ext);
    const key = info.preview === 'image' ? 'img'
              : info.preview === 'text'  ? 'txt'
              : info.cls === 'ic-pdf'    ? 'pdf'
              : info.cls === 'ic-doc'    ? 'doc'
              : info.cls === 'ic-zip'    ? 'zip'
              : 'file';
    return { svg: ICONS[key], cls: info.cls };
  };

  /* ---------------------- Router ---------------------- */
  function parseHash() {
    const raw = location.hash.replace(/^#/, '') || '/';
    if (raw === '/' || raw === '') return { name: 'home' };
    const [pathPart, qsPart] = raw.split('?');
    const segments = pathPart.split('/').filter(Boolean);
    const params = new URLSearchParams(qsPart || '');
    if (segments[0] === 'dir')    return { name: 'dir', path: segments.slice(1).map(decodeURIComponent).join('/') };
    if (segments[0] === 'file')   return { name: 'file', path: segments.slice(1).map(decodeURIComponent).join('/') };
    if (segments[0] === 'search') return { name: 'search', query: params.get('q') || '', group: params.get('t') || 'all' };
    return { name: 'home' };
  }

  function go(href) { location.hash = href; }
  const hrefForDir  = (p) => p ? `#/dir/${encodePath(p)}` : '#/';
  const hrefForFile = (p) => `#/file/${encodePath(p)}`;
  const urlForFile  = (p) => `${STATE.index.root}/${encodePath(p)}`;

  /* ---------------------- Estado ---------------------- */
  const STATE = {
    index: null,
    layout: localStorage.getItem('ompi.layout') || 'grid',
    searchGroup: 'all',
  };

  /* ---------------------- Render auxiliares ---------------------- */
  function renderBreadcrumb(parts) {
    const el = $('#breadcrumb');
    if (!parts || parts.length === 0) { el.innerHTML = ''; return; }
    el.innerHTML = parts.map((p, i) => {
      const sep = i > 0 ? `<span class="sep" aria-hidden="true">/</span>` : '';
      if (p.current) return `${sep}<span class="current">${escapeHtml(p.label)}</span>`;
      return `${sep}<a href="${p.href}">${escapeHtml(p.label)}</a>`;
    }).join('');
  }

  /* Hero badge — sección de intro a pantalla completa:
     fondo blanco con textura papel, banda diagonal coral detrás
     y badge navy oscuro centrado. Termina con un indicador "scroll". */
  function renderHeroBadge() {
    const chevron = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`;
    return `
      <section class="hero-badge" aria-labelledby="hero-title">
        <div class="hero-card">
          <span class="hero-eyebrow">Acceso a Documentos oficiales</span>
          <h1 id="hero-title" class="hero-title">OMPI</h1>
          <p class="hero-subtitle">Modelos Regionales de las Naciones Unidas</p>
          <p class="hero-tagline">Tratados, manuales y talleres del Comité OMPI. Todo lo que un delegado necesita para preparar y vivir el debate sobre propiedad intelectual.</p>
        </div>
        <a class="hero-scroll" href="#explorar" aria-label="Explorar contenido del sitio">
          <span>Explorar</span>
          ${chevron}
        </a>
      </section>
    `;
  }

  function renderHeroCompact(eyebrow, title, subtitle) {
    return `
      <section class="hero compact" aria-labelledby="hero-title">
        <span class="eyebrow"><span class="dot"></span>${escapeHtml(eyebrow)}</span>
        <h1 id="hero-title">${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
      </section>
    `;
  }

  function renderSectionHead(title, meta) {
    return `
      <div class="section-head">
        <h2>${escapeHtml(title)}</h2>
        ${meta ? `<span class="section-meta">${escapeHtml(meta)}</span>` : ''}
      </div>
    `;
  }

  function renderToolbar({ counts, activeGroup, total }) {
    const chips = TYPE_GROUPS.map((g) => {
      const c = counts[g.id] ?? 0;
      const active = g.id === activeGroup;
      return `<button class="chip" data-group="${g.id}" aria-pressed="${active}" type="button">
        ${escapeHtml(g.label)}<span class="chip-count">${c}</span>
      </button>`;
    }).join('');
    const layout = STATE.layout;
    return `
      <div class="toolbar" role="toolbar" aria-label="Filtros y vista">
        ${chips}
        <span class="spacer"></span>
        <span class="section-meta">${total} elemento${total === 1 ? '' : 's'}</span>
        <div class="view-toggle" role="group" aria-label="Modo de vista">
          <button type="button" data-layout="grid" aria-pressed="${layout === 'grid'}" aria-label="Cuadrícula" title="Cuadrícula">${ICONS.grid}</button>
          <button type="button" data-layout="list" aria-pressed="${layout === 'list'}" aria-label="Lista" title="Lista">${ICONS.list}</button>
        </div>
      </div>
    `;
  }

  /* ---------------------- Workshops ---------------------- */
  function renderWorkshopCard(ws) {
    const host = (() => {
      try { return new URL(ws.url).hostname.replace(/^www\./, ''); }
      catch { return 'enlace externo'; }
    })();
    return `
      <a class="workshop" href="${escapeHtml(ws.url)}" target="_blank" rel="noopener noreferrer">
        <div class="workshop-top">
          <span class="workshop-tag">Taller</span>
          <span class="workshop-arrow" aria-hidden="true">${ICONS.arrow}</span>
        </div>
        <h3 class="workshop-title">${escapeHtml(ws.title)}</h3>
        <p class="workshop-desc">${escapeHtml(ws.description || '')}</p>
        <span class="workshop-foot">${ICONS.external}<span>${escapeHtml(host)}</span></span>
      </a>
    `;
  }

  function renderWorkshopsSection(workshops) {
    if (!workshops || workshops.length === 0) return '';
    return `
      <section aria-labelledby="workshops-head">
        ${renderSectionHead('Talleres', `${workshops.length} sesión${workshops.length === 1 ? '' : 'es'} de formación`)}
        <div class="workshops">
          ${workshops.map(renderWorkshopCard).join('')}
        </div>
      </section>
    `;
  }

  /* ---------------------- Cards / Rows ---------------------- */
  function renderCard(entry, query) {
    const icon = iconForEntry(entry);
    if (entry.type === 'dir') {
      const href = hrefForDir(entry.path);
      return `
        <article class="card">
          <a class="card-link" href="${href}" aria-label="Abrir carpeta ${escapeHtml(entry.name)}">
            <div class="card-head">
              <span class="card-icon ${icon.cls}">${icon.svg}</span>
              <h3 class="card-title">${highlight(entry.name, query || '')}</h3>
            </div>
            <p class="card-desc">${entry.children?.length ?? 0} elemento${(entry.children?.length ?? 0) === 1 ? '' : 's'} dentro de esta carpeta.</p>
          </a>
          <div class="card-foot">
            <span class="card-meta"><span class="badge doc">Carpeta</span></span>
            <div class="card-actions">
              <a class="btn-mini" href="${href}">Abrir</a>
            </div>
          </div>
        </article>
      `;
    }

    const info  = typeInfo(entry.ext);
    const href  = hrefForFile(entry.path);
    const url   = urlForFile(entry.path);
    const desc  = entry.description || 'Sin descripción disponible para este documento.';
    const tags  = (entry.tags || []).slice(0, 3).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');

    return `
      <article class="card">
        <a class="card-link" href="${href}" aria-label="Ver ${escapeHtml(entry.name)}">
          <div class="card-head">
            <span class="card-icon ${icon.cls}">${icon.svg}</span>
            <h3 class="card-title">${highlight(entry.name, query || '')}</h3>
          </div>
          <p class="card-desc">${highlight(desc, query || '')}</p>
        </a>
        ${tags ? `<div class="card-tags">${tags}</div>` : ''}
        <div class="card-foot">
          <span class="card-meta">
            <span class="badge ${info.badge}">${escapeHtml(info.label)}</span>
            <span>${formatBytes(entry.size)}</span>
          </span>
          <div class="card-actions">
            <a class="btn-mini" href="${href}" aria-label="Ver previsualización de ${escapeHtml(entry.name)}">
              ${ICONS.eye}<span>Ver</span>
            </a>
            <a class="btn-mini btn-download" href="${url}" download="${escapeHtml(entry.name)}" aria-label="Descargar ${escapeHtml(entry.name)}">
              ${ICONS.download}<span>Descargar</span>
            </a>
          </div>
        </div>
      </article>
    `;
  }

  function renderRow(entry, query) {
    const icon = iconForEntry(entry);
    if (entry.type === 'dir') {
      const href = hrefForDir(entry.path);
      return `
        <div class="row">
          <span class="row-icon ${icon.cls}">${icon.svg}</span>
          <a class="row-title-link row-main" href="${href}">
            <span class="row-title">${highlight(entry.name, query || '')}</span>
            <span class="row-desc">${entry.children?.length ?? 0} elementos</span>
          </a>
          <div class="row-actions">
            <a class="btn-mini" href="${href}">Abrir</a>
          </div>
        </div>
      `;
    }
    const info = typeInfo(entry.ext);
    const href = hrefForFile(entry.path);
    const url  = urlForFile(entry.path);
    return `
      <div class="row">
        <span class="row-icon ${icon.cls}">${icon.svg}</span>
        <a class="row-title-link row-main" href="${href}">
          <span class="row-title">${highlight(entry.name, query || '')}</span>
          <span class="row-desc">${highlight(entry.description || '', query || '')}</span>
        </a>
        <div class="row-actions">
          <span class="row-meta"><span class="badge ${info.badge}">${escapeHtml(info.label)}</span></span>
          <a class="btn-mini" href="${href}" aria-label="Ver ${escapeHtml(entry.name)}">${ICONS.eye}<span>Ver</span></a>
          <a class="btn-mini btn-download" href="${url}" download="${escapeHtml(entry.name)}" aria-label="Descargar ${escapeHtml(entry.name)}">
            ${ICONS.download}<span>Descargar</span>
          </a>
        </div>
      </div>
    `;
  }

  function renderEntries(entries, { query = '', layout = STATE.layout } = {}) {
    if (entries.length === 0) {
      return `
        <div class="empty">
          ${ICONS.inbox}
          <h3>Sin resultados</h3>
          <p>No encontramos documentos que coincidan con tu búsqueda o filtro.</p>
        </div>
      `;
    }
    if (layout === 'list') return `<div class="list">${entries.map((e) => renderRow(e, query)).join('')}</div>`;
    return `<div class="grid">${entries.map((e) => renderCard(e, query)).join('')}</div>`;
  }

  function sortEntries(entries) {
    return [...entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
    });
  }

  /* ---------------------- Vistas ---------------------- */
  function viewHome() {
    const state = STATE.index;
    const entries = sortEntries(state.tree.children);
    const counts  = countByGroup(state, state.flat);

    // Sin breadcrumb en home: el hero ya hace la veces de "estás en el inicio".
    renderBreadcrumb([]);

    $('#view').innerHTML = `
      ${renderHeroBadge()}
      <div id="explorar">
        ${renderWorkshopsSection(state.workshops)}
        ${renderSectionHead('Documentos oficiales', `${state.flat.length} archivo${state.flat.length === 1 ? '' : 's'} disponibles`)}
        ${renderToolbar({ counts, activeGroup: 'all', total: entries.length })}
        <div id="entries">${renderEntries(entries)}</div>
      </div>
    `;

    wireToolbar({ scope: 'home' });
    wireHeroScroll();
  }

  /* Scroll suave desde el indicador "Explorar" del hero al resto del sitio. */
  function wireHeroScroll() {
    const btn = $('.hero-scroll');
    if (!btn) return;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById('explorar');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function viewDir(path) {
    const dir = getDir(STATE.index, path);
    if (!dir) return viewNotFound(`Carpeta no encontrada: ${path}`);

    const parts = path.split('/').filter(Boolean);
    const crumbs = [{ label: 'Inicio', href: '#/' }];
    let accum = '';
    parts.forEach((p, i) => {
      accum = accum ? `${accum}/${p}` : p;
      const last = i === parts.length - 1;
      crumbs.push(last ? { label: p, current: true } : { label: p, href: hrefForDir(accum) });
    });
    renderBreadcrumb(crumbs);

    const entries = sortEntries(dir.children);
    const files = entries.filter((e) => e.type === 'file');
    const counts = countByGroup(STATE.index, files);
    counts.all = entries.length;

    $('#view').innerHTML = `
      ${renderHeroCompact(
        'Carpeta',
        parts[parts.length - 1] || 'Contenido',
        `${entries.length} elemento${entries.length === 1 ? '' : 's'} dentro de esta sección.`
      )}
      ${renderToolbar({ counts, activeGroup: 'all', total: entries.length })}
      <div id="entries">${renderEntries(entries)}</div>
    `;

    wireToolbar({ scope: 'dir', entries });
  }

  /* ¿Estamos en una pantalla pequeña? La mayoría de navegadores
     móviles NO renderizan PDF dentro de iframes — mejor mostrar
     una tarjeta clara con botones de descarga y abrir externo. */
  const MOBILE_MQ = window.matchMedia('(max-width: 720px)');
  const isMobile = () => MOBILE_MQ.matches;

  /* Verifica si el archivo es accesible vía HTTP. Detecta dos casos:
       1) Status != 2xx → no existe / sin permiso
       2) Status OK pero content-type HTML → el servidor devolvió una
          página de error (p. ej. "Cannot GET …" de un static server). */
  async function checkFileAvailable(url) {
    try {
      const r = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (!r.ok) return false;
      const ct = (r.headers.get('content-type') || '').toLowerCase();
      if (ct.startsWith('text/html')) return false;
      return true;
    } catch { return false; }
  }

  /* Skeleton de carga mientras decidimos qué mostrar en .preview-wrap */
  function renderPreviewLoading() {
    return `
      <div class="preview-loading" role="status" aria-live="polite">
        <span class="preview-loading-spinner" aria-hidden="true"></span>
        <span class="preview-loading-label">Cargando previsualización…</span>
      </div>
    `;
  }

  /* Tarjeta de fallback: cuando no se puede mostrar la vista previa
     (móvil, archivo inaccesible, formato no compatible) ofrecemos
     acciones claras en lugar de un iframe roto o un mensaje seco. */
  function renderPreviewFallback({ title, message, file, fileUrl, kind = 'info' }) {
    const fileIcon = `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M38 6H16a4 4 0 0 0-4 4v44a4 4 0 0 0 4 4h32a4 4 0 0 0 4-4V20L38 6Z"/><path d="M38 6v14h14"/><text x="32" y="44" text-anchor="middle" font-family="'Barlow Condensed',sans-serif" font-size="13" font-weight="800" stroke="none" fill="currentColor">PDF</text></svg>`;
    return `
      <div class="preview-fallback" data-kind="${kind}">
        <span class="preview-fallback-icon">${fileIcon}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(message)}</p>
        <div class="preview-fallback-actions">
          <a class="btn btn-primary" href="${fileUrl}" download="${escapeHtml(file.name)}">
            ${ICONS.download}<span>Descargar</span>
          </a>
          <a class="btn btn-secondary" href="${fileUrl}" target="_blank" rel="noopener">
            ${ICONS.external}<span>Abrir en pestaña</span>
          </a>
        </div>
      </div>
    `;
  }

  function viewFile(path) {
    const file = getFile(STATE.index, path);
    if (!file) return viewNotFound(`Archivo no encontrado: ${path}`);

    const parts = path.split('/').filter(Boolean);
    const crumbs = [{ label: 'Inicio', href: '#/' }];
    let accum = '';
    for (let i = 0; i < parts.length - 1; i++) {
      accum = accum ? `${accum}/${parts[i]}` : parts[i];
      crumbs.push({ label: parts[i], href: hrefForDir(accum) });
    }
    crumbs.push({ label: file.name, current: true });
    renderBreadcrumb(crumbs);

    const info = typeInfo(file.ext);
    const fileUrl = urlForFile(file.path);
    const previewKind = info.preview;
    const mobile = isMobile();

    // Decide qué meter en .preview-wrap ANTES de renderizar.
    let previewHtml = '';
    let needsAsyncCheck = false; // true → verificamos PDF en background

    if (previewKind === 'pdf') {
      if (mobile) {
        // Móvil: nunca iframe — los lectores nativos no funcionan inline
        previewHtml = renderPreviewFallback({
          title: 'Vista previa optimizada para escritorio',
          message: 'En dispositivos móviles los PDFs no se previsualizan dentro del navegador. Descárgalo o ábrelo en una pestaña nueva para leerlo cómodamente.',
          file, fileUrl, kind: 'mobile',
        });
      } else {
        // Desktop: spinner mientras confirmamos que el archivo existe,
        // así evitamos el "Cannot GET …" del iframe roto.
        previewHtml = renderPreviewLoading();
        needsAsyncCheck = true;
      }
    } else if (previewKind === 'image') {
      previewHtml = `<img src="${fileUrl}" alt="${escapeHtml(file.name)}" loading="lazy"/>`;
    } else if (previewKind === 'text') {
      previewHtml = `<pre class="preview-text" data-src="${fileUrl}">Cargando…</pre>`;
    } else {
      // Formato sin preview en navegador: tarjeta con acciones
      previewHtml = renderPreviewFallback({
        title: 'Vista previa no disponible',
        message: `Este tipo de archivo (${info.label}) no se puede previsualizar dentro del navegador. Descárgalo o ábrelo en una pestaña para verlo.`,
        file, fileUrl, kind: 'unsupported',
      });
    }

    const desc = file.description || 'Sin descripción disponible para este documento.';
    const tags = (file.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');

    $('#view').innerHTML = `
      <div class="file-detail">
        <div class="preview-wrap">${previewHtml}</div>
        <aside class="file-aside" aria-label="Detalles del archivo">
          <div class="badge-row">
            <span class="badge ${info.badge}">${escapeHtml(info.label)}</span>
            ${tags}
          </div>
          <h1>${escapeHtml(file.name)}</h1>

          <div class="file-description">
            <span class="label">Descripción</span>
            ${escapeHtml(desc)}
          </div>

          <div class="actions">
            <a class="btn btn-primary" href="${fileUrl}" download="${escapeHtml(file.name)}">
              ${ICONS.download}<span>Descargar</span>
            </a>
            <a class="btn btn-secondary" href="${fileUrl}" target="_blank" rel="noopener">
              ${ICONS.external}<span>Abrir en pestaña</span>
            </a>
          </div>

          <ul class="meta-list">
            <li><span class="k">Tipo</span><span class="v">${escapeHtml(info.label)}</span></li>
            <li><span class="k">Tamaño</span><span class="v">${formatBytes(file.size)}</span></li>
            <li><span class="k">Modificado</span><span class="v">${formatDate(file.modified)}</span></li>
            <li><span class="k">Ruta</span><span class="v" title="${escapeHtml(file.path)}">${escapeHtml(file.path)}</span></li>
          </ul>
        </aside>
      </div>
    `;

    // Si rendereamos texto, lo cargamos vía fetch.
    const pre = $('.preview-text');
    if (pre) {
      fetch(pre.dataset.src)
        .then((r) => r.ok ? r.text() : Promise.reject(new Error(`HTTP ${r.status}`)))
        .then((t) => { pre.textContent = t; })
        .catch((err) => { pre.textContent = `No se pudo cargar el archivo: ${err.message}`; });
    }

    // Desktop PDF: confirmamos primero que el archivo es accesible.
    // Si OK → iframe. Si no → tarjeta de fallback con acciones.
    if (needsAsyncCheck) {
      checkFileAvailable(fileUrl).then((ok) => {
        const wrap = $('.preview-wrap');
        if (!wrap) return;
        if (ok) {
          wrap.innerHTML = `<iframe src="${fileUrl}#view=FitH" title="Previsualización: ${escapeHtml(file.name)}" loading="lazy"></iframe>`;
        } else {
          wrap.innerHTML = renderPreviewFallback({
            title: 'No pudimos cargar la vista previa',
            message: 'El archivo no está accesible desde este servidor. Si lo necesitas, descárgalo o ábrelo en una pestaña nueva.',
            file, fileUrl, kind: 'unavailable',
          });
        }
      });
    }
  }

  function viewSearch(query, group) {
    STATE.searchGroup = group || 'all';
    const results = search(STATE.index, query, STATE.searchGroup);
    const counts  = countByGroup(STATE.index, STATE.index.flat);

    renderBreadcrumb([
      { label: 'Inicio', href: '#/' },
      { label: query ? `Búsqueda · "${query}"` : 'Búsqueda', current: true },
    ]);

    $('#view').innerHTML = `
      ${renderHeroCompact(
        'Búsqueda',
        query ? `Resultados para "${query}"` : 'Buscar en el portal',
        `${results.length} coincidencia${results.length === 1 ? '' : 's'} en todo el contenido indexado.`
      )}
      ${renderToolbar({ counts, activeGroup: STATE.searchGroup, total: results.length })}
      <div id="entries">${renderEntries(results, { query, layout: STATE.layout })}</div>
    `;

    wireToolbar({ scope: 'search', query });
  }

  function viewNotFound(msg) {
    renderBreadcrumb([{ label: 'Inicio', href: '#/' }, { label: 'No encontrado', current: true }]);
    $('#view').innerHTML = `
      <div class="error" role="alert">
        ${ICONS.warn}
        <h3>Recurso no disponible</h3>
        <p>${escapeHtml(msg)}</p>
        <p><a class="btn btn-secondary" href="#/">Volver al inicio</a></p>
      </div>
    `;
  }

  function viewLoadError(err) {
    renderBreadcrumb([]);
    $('#view').innerHTML = `
      <div class="error" role="alert">
        ${ICONS.warn}
        <h3>No se pudo cargar el índice</h3>
        <p>${escapeHtml(err.message || String(err))}</p>
        <p style="color:var(--muted);font-size:14px;">
          Sirve el sitio con un servidor estático (por ejemplo:
          <code>python -m http.server</code> dentro de la carpeta del proyecto)
          y verifica que <code>manifest.json</code> exista.
        </p>
      </div>
    `;
  }

  /* ---------------------- Cableado ---------------------- */
  function wireToolbar({ scope, entries, query }) {
    $$('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = btn.dataset.group;
        if (scope === 'search') {
          const qs = new URLSearchParams({ q: query || '', t: g });
          go(`#/search?${qs.toString()}`);
        } else {
          const base = scope === 'home' ? STATE.index.tree.children : (entries || []);
          const filtered = sortEntries(base.filter((e) => {
            if (e.type === 'dir') return g === 'all';
            const grp = TYPE_GROUPS.find((x) => x.id === g);
            return grp ? grp.match(e.ext) : true;
          }));
          $$('.chip').forEach((c) => c.setAttribute('aria-pressed', c.dataset.group === g));
          $('#entries').innerHTML = renderEntries(filtered, { layout: STATE.layout });
          const metaEls = $$('.toolbar .section-meta');
          if (metaEls.length) metaEls[metaEls.length - 1].textContent = `${filtered.length} elemento${filtered.length === 1 ? '' : 's'}`;
        }
      });
    });

    $$('.view-toggle button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const layout = btn.dataset.layout;
        STATE.layout = layout;
        localStorage.setItem('ompi.layout', layout);
        $$('.view-toggle button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.layout === layout));
        const activeChip = $('.chip[aria-pressed="true"]');
        if (activeChip) activeChip.click();
        else {
          const cur = scope === 'home' ? sortEntries(STATE.index.tree.children) : (entries || []);
          $('#entries').innerHTML = renderEntries(cur, { query, layout });
        }
      });
    });
  }

  function wireSearchInput() {
    const input = $('#search');
    let t;
    input.addEventListener('input', () => {
      clearTimeout(t);
      const q = input.value.trim();
      t = setTimeout(() => {
        const qs = new URLSearchParams({ q, t: STATE.searchGroup || 'all' });
        if (!q && location.hash.startsWith('#/search')) go('#/');
        else if (q) go(`#/search?${qs.toString()}`);
      }, 120);
    });

    window.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === '/' && tag !== 'input' && tag !== 'textarea') {
        e.preventDefault();
        input.focus();
        input.select();
      }
      if (e.key === 'Escape' && document.activeElement === input) input.blur();
    });
  }

  /* ---------------------- Boot ---------------------- */
  function dispatch() {
    const route = parseHash();
    if (window.scrollY > 80) window.scrollTo({ top: 0, behavior: 'smooth' });
    else window.scrollTo({ top: 0, behavior: 'auto' });
    try {
      if (route.name === 'home') return viewHome();
      if (route.name === 'dir')  return viewDir(route.path);
      if (route.name === 'file') return viewFile(route.path);
      if (route.name === 'search') {
        const input = $('#search');
        if (input && input.value !== route.query) input.value = route.query;
        return viewSearch(route.query, route.group);
      }
      viewNotFound('Ruta desconocida.');
    } catch (e) {
      console.error(e);
      viewLoadError(e);
    }
  }

  async function boot() {
    wireSearchInput();
    try {
      STATE.index = await loadIndex();
    } catch (err) {
      console.error(err);
      return viewLoadError(err);
    }
    window.addEventListener('hashchange', dispatch);
    dispatch();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
