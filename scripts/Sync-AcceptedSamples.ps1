[CmdletBinding()]
param(
    [string]$RemoteHost = "h100-node61",
    [string]$RemoteRun = "production-20260810-48k-singleturn-b128-r1",
    [string]$RemoteRoot = "/mnt/beegfs/wjt/clbench_life_rl",
    [string]$Destination
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $Destination) {
    $Destination = Join-Path $projectRoot "source-data\current"
}
$destinationPath = [IO.Path]::GetFullPath($Destination)
New-Item -ItemType Directory -Force -Path $destinationPath | Out-Null
$remoteAccepted = "$RemoteRoot/runs/$RemoteRun/accepted"
$remotePattern = "${RemoteHost}:$remoteAccepted/*.json"

Write-Host "Downloading accepted synthetic samples from $RemoteHost ..."
& scp $remotePattern "$destinationPath/"
if ($LASTEXITCODE -ne 0) {
    throw "scp failed with exit code $LASTEXITCODE"
}

$count = @(Get-ChildItem -LiteralPath $destinationPath -File -Filter *.json).Count
Write-Host "Local accepted sample files: $count"
