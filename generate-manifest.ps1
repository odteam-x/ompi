# =========================================================
#  OMPI · Modelos Regionales ONU — generador de manifest.json
# ---------------------------------------------------------
#  Escanea la carpeta actual y produce "manifest.json" con la
#  metadata necesaria para indexar los documentos.
#
#  Estructura plana: HTML, CSS, JS, PNG y PDFs viven juntos en
#  la misma carpeta. Este script se excluye a sí mismo y a los
#  archivos del sitio del índice.
#
#  Uso (desde la carpeta del proyecto):
#    powershell -ExecutionPolicy Bypass -File .\generate-manifest.ps1
#
#  Opciones:
#    -SourcePath <ruta>   Carpeta a indexar (default: carpeta del script)
#    -OutFile    <ruta>   Salida JSON       (default: .\manifest.json)
# =========================================================

param(
  [string]$SourcePath = $PSScriptRoot,
  [string]$OutFile    = (Join-Path $PSScriptRoot "manifest.json")
)

$ErrorActionPreference = "Stop"

$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path

# Archivos que pertenecen al propio sitio y NO se indexan.
$ExcludeFiles = @(
  "index.html",
  "styles.css",
  "app.js",
  "manifest.json",
  "README.md",
  "generate-manifest.ps1",
  "generate-manifest.mjs",
  "isotipo.png",
  "mr.png"
)

function Get-RelativePath([string]$full, [string]$base) {
  $b = $base.TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
  $rel = $full.Substring($b.Length)
  return $rel -replace '\\','/'
}

function Scan([string]$path) {
  $items = @()
  $children = Get-ChildItem -LiteralPath $path -Force |
    Sort-Object @{Expression={$_.PSIsContainer}; Descending=$true}, Name
  foreach ($c in $children) {
    if ($c.Name -like '.*') { continue }                      # ocultos
    if (-not $c.PSIsContainer -and $ExcludeFiles -contains $c.Name) { continue }
    if ($c.PSIsContainer) {
      $items += [ordered]@{
        type     = 'dir'
        name     = $c.Name
        children = ,@(Scan $c.FullName)
      }
    } else {
      $items += [ordered]@{
        type     = 'file'
        name     = $c.Name
        path     = (Get-RelativePath $c.FullName $SourcePath)
        ext      = ($c.Extension.TrimStart('.')).ToLowerInvariant()
        size     = [int64]$c.Length
        modified = $c.LastWriteTimeUtc.ToString("yyyy-MM-ddTHH:mm:ssZ")
      }
    }
  }
  return $items
}

# Si ya existe un manifest, conservamos las descripciones y tags
# previos (no se sobrescriben datos curados al regenerar).
$prevDescByPath = @{}
$prevTagsByPath = @{}
if (Test-Path -LiteralPath $OutFile) {
  try {
    $prev = Get-Content -LiteralPath $OutFile -Raw -Encoding UTF8 | ConvertFrom-Json
    function Read-Prev($entries) {
      foreach ($e in $entries) {
        if ($e.type -eq 'dir' -and $e.children) { Read-Prev $e.children }
        elseif ($e.type -eq 'file' -and $e.path) {
          if ($e.description) { $script:prevDescByPath[$e.path] = $e.description }
          if ($e.tags)        { $script:prevTagsByPath[$e.path] = $e.tags }
        }
      }
    }
    Read-Prev $prev.items
  } catch {
    Write-Host "Aviso: no se pudo leer el manifest previo; se ignora."
  }
}

$items = Scan $SourcePath

# Reinyectar descripciones y tags conservados.
function Hydrate($entries) {
  foreach ($e in $entries) {
    if ($e.type -eq 'dir') { Hydrate $e.children }
    elseif ($e.type -eq 'file') {
      if ($prevDescByPath.ContainsKey($e.path)) { $e.description = $prevDescByPath[$e.path] }
      if ($prevTagsByPath.ContainsKey($e.path)) { $e.tags        = $prevTagsByPath[$e.path] }
    }
  }
}
Hydrate $items

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  root        = '.'
  items       = ,@($items)
}

$json = $manifest | ConvertTo-Json -Depth 25
[IO.File]::WriteAllText($OutFile, $json, [Text.UTF8Encoding]::new($false))

Write-Host "Manifest generado:" $OutFile
Write-Host "Total entradas raiz:" $items.Count
