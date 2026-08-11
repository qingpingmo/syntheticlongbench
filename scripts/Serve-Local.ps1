[CmdletBinding()]
param([int]$Port = 4173)

$ErrorActionPreference = "Stop"
$root = Join-Path (Split-Path -Parent $PSScriptRoot) "public"
if (-not (Test-Path -LiteralPath (Join-Path $root "data\catalog.json"))) {
    throw "No built dataset found. Run scripts\\Build-WebData.ps1 first."
}
Write-Host "Serving public explorer at http://127.0.0.1:$Port"
py -3 -m http.server $Port --directory $root
