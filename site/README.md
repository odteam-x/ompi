# OMPI · Portal Documental

Sitio estático y minimalista para navegar, buscar y descargar los documentos que viven en esta carpeta del proyecto. Pensado para responder a la marca institucional **OMPI / WIPO** con sobriedad: tipografía única, paleta azul ONU y mucho espacio en blanco.

## Estructura

```
OMPI/
├─ <documentos .pdf, imágenes, etc.>
└─ site/
   ├─ index.html              ← shell del sitio
   ├─ styles.css              ← estilos (diseño responsive, mobile + desktop)
   ├─ app.js                  ← lógica (indexer, modelo, vista, router)
   ├─ manifest.json           ← índice de la carpeta (auto-generado)
   ├─ generate-manifest.ps1   ← regenerador en PowerShell (Windows)
   └─ generate-manifest.mjs   ← regenerador en Node (multiplataforma)
```

La lógica de **indexado** (cargar/normalizar `manifest.json`) está separada de la **presentación**. Para apuntar el sitio a otra ruta basta con regenerar el manifest desde otra carpeta — no hay que tocar el HTML.

## Cómo ejecutarlo

Por restricciones de los navegadores con `file://`, sirve la carpeta `site/` desde un servidor estático.

**Opción A — Python (preinstalado en muchos sistemas):**

```powershell
cd C:\Users\judit\Downloads\OMPI\site
python -m http.server 8080
# abre http://localhost:8080
```

**Opción B — Node:**

```powershell
cd C:\Users\judit\Downloads\OMPI\site
npx http-server -p 8080 .
```

**Opción C — VS Code:** extensión *Live Server* sobre `index.html`.

## Regenerar el índice tras agregar/quitar archivos

**PowerShell:**

```powershell
cd C:\Users\judit\Downloads\OMPI\site
powershell -ExecutionPolicy Bypass -File .\generate-manifest.ps1
```

**Node:**

```powershell
cd C:\Users\judit\Downloads\OMPI\site
node .\generate-manifest.mjs
```

Para indexar otra carpeta:

```powershell
# PowerShell
.\generate-manifest.ps1 -SourcePath "D:\otra\carpeta"

# Node
$env:OMPI_SOURCE = "D:\otra\carpeta"
node .\generate-manifest.mjs
```

> El manifest soporta subcarpetas (entradas `type: "dir"` con `children`). El generador ya las recorre recursivamente.

## Reemplazar el logo institucional

En `index.html`, dentro de `<a class="brand">`, hay un bloque `<svg class="brand-mark">` marcado como *BRAND PLACEHOLDER*. Sustitúyelo por el archivo oficial:

```html
<img src="logo-ompi.svg" alt="OMPI · WIPO" class="brand-logo" />
```

Coloca `logo-ompi.svg` (o `.png`) dentro de `site/`. La clase `.brand-logo` ya define un tamaño coherente con el header.

## Características incluidas

- Búsqueda instantánea con resaltado de coincidencias (tecla `/` para enfocar).
- Filtros por tipo (PDF, imágenes, documentos, texto).
- Vista en cuadrícula o lista (preferencia persistida en `localStorage`).
- Navegación por carpetas con breadcrumb.
- Vista de detalle con **previsualización embebida**: PDF (iframe), imágenes (`<img>`), texto/Markdown/JSON/CSV (fetch + `<pre>`).
- Estados vacíos y de error explícitos.
- Accesible: skip-link, foco visible, ARIA en toolbar y `aria-live` en la vista principal.
- Responsive: mobile-first con ajuste a escritorio.
- Sin dependencias en runtime (vanilla JS + Inter via Google Fonts).

## Decisiones de diseño

- Una sola familia tipográfica (**Inter**) para evitar ruido.
- Azul institucional `#009edb` reservado para acentos (botón primario, foco, marca). El cuerpo trabaja con grises neutros.
- Cards y filas con bordes finos en lugar de sombras pesadas → estética de documento, no de dashboard.
- Iconografía inline en SVG (sin librería externa, sin parpadeos).
