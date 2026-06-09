# =========================================================
#  OMPI · Portal Documental — generador de manifest.json
# ---------------------------------------------------------
#  Escanea la carpeta de proyecto (por defecto, la carpeta
#  padre de "site/") y produce "site/manifest.json" con la
#  metadata necesaria para indexar el contenido.
#
#  Uso (desde la carpeta "site/"):
#    powershell -ExecutionPolicy Bypass -File .\generate-manifest.ps1
#
#  Opciones:
#    -SourcePath <ruta>   Carpeta a indexar (default: ..)
#    -OutFile    <ruta>   Salida JSON       (default: .\manifest.json)
# =========================================================

param(
  [string]$SourcePath = (Join-Path $PSScriptRoot ".."),
  [string]$OutFile    = (Join-Path $PSScriptRoot "manifest.json")
)

$ErrorActionPreference = "Stop"

$SourcePath = (Resolve-Path -LiteralPath $SourcePath).Path
$siteFull   = (Resolve-Path -LiteralPath $PSScriptRoot).Path

function Get-RelativePath([string]$full, [string]$base) {
  $b = $base.TrimEnd('\','/') + [IO.Path]::DirectorySeparatorChar
  $rel = $full.Substring($b.Length)
  return $rel -replace '\\','/'
}

# Recorre recursivamente, excluyendo la carpeta del propio sitio.
function Scan([string]$path) {
  $items = @()
  $children = Get-ChildItem -LiteralPath $path -Force | Sort-Object @{Expression={$_.PSIsContainer}; Descending=$true}, Name
  foreach ($c in $children) {
    if ($c.FullName -ieq $siteFull) { continue }      # excluir el propio sitio
    if ($c.Name -like '.*')          { continue }      # excluir ocultos
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

$items = Scan $SourcePath

$manifest = [ordered]@{
  generatedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
  root        = '..'   # ruta relativa desde site/ hacia la carpeta de archivos
  items       = ,@($items)
}

$json = $manifest | ConvertTo-Json -Depth 25
[IO.File]::WriteAllText($OutFile, $json, [Text.UTF8Encoding]::new($false))

Write-Host "Manifest generado:" $OutFile
Write-Host "Total entradas raíz:" $items.Count
