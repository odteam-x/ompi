# OMPI · Modelos Regionales ONU — Acceso a Documentos

Sitio estático para navegar, buscar y descargar los documentos oficiales del **Comité OMPI** dentro de los **Modelos Regionales de las Naciones Unidas**. Diseño con tipografías Barlow + Source Sans 3, fondo azul oscuro gradiente y acento coral.

## Estructura (plana, lista para GitHub Pages)

Todo vive en la misma carpeta — sin subdirectorios — para que GitHub Pages la publique tal cual:

```
OMPI/
├─ index.html              ← shell del sitio
├─ styles.css              ← estilos (responsive, gradientes, animaciones)
├─ app.js                  ← lógica (indexer, modelo, vista, router)
├─ manifest.json           ← índice de los documentos
├─ generate-manifest.ps1   ← regenerador PowerShell (Windows)
├─ generate-manifest.mjs   ← regenerador Node (multiplataforma)
├─ isotipo.png             ← isotipo OMPI (spiral azul marino)
├─ mr.png                  ← isotipo MR (Modelos Regionales, blanco)
├─ README.md
└─ <documentos .pdf, imágenes, etc.>
```

La lógica de **indexado** está separada de la **presentación**: el HTML lee `manifest.json`, así que reemplazar/agregar documentos solo requiere regenerar el manifest.

## Cómo ejecutarlo localmente

Por restricciones de `file://`, sirve la carpeta con un servidor estático.

**Python:**

```powershell
cd C:\Users\judit\Downloads\OMPI
python -m http.server 8080
# abre http://localhost:8080
```

**Node:**

```powershell
cd C:\Users\judit\Downloads\OMPI
npx http-server -p 8080 .
```

**VS Code:** abrir `index.html` con la extensión *Live Server*.

## Publicar en GitHub Pages

1. Sube esta carpeta a un repositorio de GitHub.
2. En **Settings → Pages**, selecciona la rama (`main`) y carpeta `/ (root)`.
3. Tu sitio quedará disponible en `https://<usuario>.github.io/<repo>/`.

Como todos los archivos están al mismo nivel, los enlaces relativos del manifest (`./archivo.pdf`) funcionan sin configuración adicional.

## Regenerar el índice tras agregar/quitar archivos

Ambos generadores **conservan automáticamente** las descripciones y tags del manifest anterior (no se pierden datos curados al regenerar).

**PowerShell:**

```powershell
cd C:\Users\judit\Downloads\OMPI
powershell -ExecutionPolicy Bypass -File .\generate-manifest.ps1
```

**Node:**

```powershell
cd C:\Users\judit\Downloads\OMPI
node .\generate-manifest.mjs
```

Los archivos del propio sitio (`index.html`, `styles.css`, `app.js`, `manifest.json`, `README.md`, los dos `*.png` de marca y los dos generadores) se excluyen automáticamente del índice.

Para indexar otra carpeta:

```powershell
.\generate-manifest.ps1 -SourcePath "D:\otra\carpeta"

# Node
$env:OMPI_SOURCE = "D:\otra\carpeta"
node .\generate-manifest.mjs
```

## Editar descripciones de los documentos

Cada entrada en `manifest.json` tiene `description` y `tags`. Edita el JSON manualmente; al regenerar con cualquiera de los dos scripts esos campos **se preservan** (se vuelven a inyectar haciendo match por `path`).

## Reemplazar los isotipos

- **OMPI**: sustituye `isotipo.png` (el PNG original puede ser azul marino o blanco — el CSS lo pinta en blanco automáticamente vía `filter: brightness(0) invert(1)`).
- **MR**: sustituye `mr.png`. Si el nuevo archivo ya es blanco con fondo transparente, mantén la clase `has-img` en el `<span>` del header (deshabilita el filtro). Si el archivo es oscuro y necesita pintarse en blanco, quita la clase `has-img`.

## Características

- Búsqueda instantánea con resaltado, atajo `/` para enfocar.
- Filtros por tipo (PDF, imágenes, documentos, texto) con conteos.
- Vista cuadrícula o lista, preferencia persistida en `localStorage`.
- Navegación por subcarpetas con breadcrumb.
- Detalle con previsualización embebida: PDF (iframe), imágenes, texto/MD/JSON/CSV.
- Cada documento muestra descripción + botón **Descargar** directo desde la tarjeta.
- Responsive mobile-first; hover y transiciones suaves; respeta `prefers-reduced-motion`.

## Paleta y tipografías

- Azules: `#001A3D` · `#002554` · `#014A8F` · `#0099E0` · `#4FC7F5` · `#B7E3F4`.
- Acento coral: `#FF6F61`.
- Tipografías: **Barlow** (títulos, marca) y **Source Sans 3** (cuerpo).
