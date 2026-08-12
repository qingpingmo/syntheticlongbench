[CmdletBinding()]
param(
    [string]$Source,
    [string]$PublicOutput,
    [string]$PrivateOutput
)

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $Source) { $Source = Join-Path $projectRoot "source-data\current" }
if (-not $PublicOutput) { $PublicOutput = Join-Path $projectRoot "public" }
if (-not $PrivateOutput) { $PrivateOutput = Join-Path $projectRoot "private-review" }

function Write-Utf8Json([string]$Path, $Value) {
    $directory = Split-Path -Parent $Path
    New-Item -ItemType Directory -Force -Path $directory | Out-Null
    $json = $Value | ConvertTo-Json -Depth 64
    [IO.File]::WriteAllText($Path, $json, [Text.UTF8Encoding]::new($false))
}

function Copy-Shell([string]$Destination, [string]$Mode) {
    $project = Split-Path -Parent $PSScriptRoot
    $shell = Join-Path $project "site-shell"
    New-Item -ItemType Directory -Force -Path $Destination | Out-Null
    Copy-Item -LiteralPath (Join-Path $shell "styles.css") -Destination (Join-Path $Destination "styles.css") -Force
    Copy-Item -LiteralPath (Join-Path $shell "app.js") -Destination (Join-Path $Destination "app.js") -Force
    $html = Get-Content -LiteralPath (Join-Path $shell "index.html") -Raw -Encoding utf8
    $html = $html.Replace('data-mode="public"', "data-mode=`"$Mode`"")
    [IO.File]::WriteAllText((Join-Path $Destination "index.html"), $html, [Text.UTF8Encoding]::new($false))
}

$sourcePath = [IO.Path]::GetFullPath($Source)
if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Source directory does not exist: $sourcePath"
}
$files = @(Get-ChildItem -LiteralPath $sourcePath -File -Filter *.json | Sort-Object Name)
if ($files.Count -eq 0) {
    throw "No accepted JSON files found in: $sourcePath"
}

$publicPath = [IO.Path]::GetFullPath($PublicOutput)
$privatePath = [IO.Path]::GetFullPath($PrivateOutput)
Copy-Shell $publicPath "public"
Copy-Shell $privatePath "private"
New-Item -ItemType Directory -Force -Path (Join-Path $publicPath "data\samples") | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $privatePath "data\samples") | Out-Null
New-Item -ItemType File -Force -Path (Join-Path $publicPath ".nojekyll") | Out-Null

$catalog = @()
$sourceRunCounts = @{}
foreach ($file in $files) {
    $raw = Get-Content -LiteralPath $file.FullName -Raw -Encoding utf8 | ConvertFrom-Json
    $runId = [string]$raw.provenance.run_id
    if ([string]::IsNullOrWhiteSpace($runId)) { $runId = "unknown" }
    if ($sourceRunCounts.ContainsKey($runId)) { $sourceRunCounts[$runId]++ } else { $sourceRunCounts[$runId] = 1 }
    $blueprint = $raw.blueprint
    $documents = @(
        foreach ($document in @($raw.documents)) {
            [ordered]@{
                id = $document.id
                title = $document.title
                genre = $document.genre
                logical_source_id = $document.logical_source_id
                chunk_index = $document.chunk_index
                chunk_count = $document.chunk_count
                content = $document.content
                character_count = $document.content.Length
            }
        }
    )
    $auditPasses = @($raw.audits | Where-Object { $_.overall_pass -eq $true }).Count
    $quality = [ordered]@{
        evidence_count = @($blueprint.evidence).Count
        rubric_count = @($blueprint.rubrics).Count
        audit_count = @($raw.audits).Count
        passed_audits = $auditPasses
        blind_recovered_facts = @($raw.blind_recovery.facts).Count
        accepted = $true
    }
    $safeSample = [ordered]@{
        schema_version = $raw.schema_version
        id = $raw.id
        scenario = $raw.scenario
        task = $blueprint.task
        response_format = $blueprint.response_format
        target_turn_id = $blueprint.target_turn_id
        context = $raw.context
        documents = $documents
        quality_summary = $quality
        disclosure = [ordered]@{
            mode = "public-policy-view"
            excluded = @("canonical_answer", "evidence", "rubrics", "blind_recovery", "audits", "provenance")
            note = "Private evaluator fields are intentionally excluded from the public website."
        }
    }
    Write-Utf8Json (Join-Path $publicPath "data\samples\$($raw.id).json") $safeSample
    Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $privatePath "data\samples\$($raw.id).json") -Force
    $catalog += [ordered]@{
        id = $raw.id
        schema_version = $raw.schema_version
        scenario = $raw.scenario
        task_preview = (($blueprint.task -replace '\s+', ' ').Trim().Substring(0, [Math]::Min(300, (($blueprint.task -replace '\s+', ' ').Trim()).Length)))
        context_characters = $raw.context.Length
        document_count = $documents.Count
        logical_source_count = @($documents.logical_source_id | Select-Object -Unique).Count
        quality = $quality
    }
}

$sourceRuns = @(
    $sourceRunCounts.GetEnumerator() |
        Sort-Object Name |
        ForEach-Object { [ordered]@{ run_id = $_.Key; sample_count = $_.Value } }
)
$languages = @($catalog.scenario.language | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Sort-Object -Unique)

$catalogPayload = [ordered]@{
    dataset = [ordered]@{
        title = "Long Context Atlas"
        subtitle = "Synthetic, audited long-context tasks for single-turn RL"
        source_run = if ($sourceRuns.Count -eq 1) { $sourceRuns[0].run_id } else { "mixed accepted-sample snapshot" }
        source_runs = $sourceRuns
        languages = $languages
        generated_at_utc = [DateTime]::UtcNow.ToString("o")
        sample_count = $catalog.Count
        privacy = "public-policy-view"
    }
    samples = $catalog
}
Write-Utf8Json (Join-Path $publicPath "data\catalog.json") $catalogPayload
$catalogPayload.dataset.privacy = "local-private-review"
Write-Utf8Json (Join-Path $privatePath "data\catalog.json") $catalogPayload

Write-Host "Built $($catalog.Count) public samples in $publicPath"
Write-Host "Built local private reviewer in $privatePath"
