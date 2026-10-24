$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$pack = Join-Path $project 'src/assets/library/brumaluz-hamlet'
$destination = Join-Path $project 'art/hamlet/brumaluz-hamlet-glb.zip'
$files = @(
    (Join-Path $pack 'objects'),
    (Join-Path $pack 'textures'),
    (Join-Path $pack 'catalog.json'),
    (Join-Path $project 'art/hamlet/manifest.json'),
    (Join-Path $project 'docs/HAMLET-ASSETS.md')
)
foreach ($file in $files) {
    if (-not (Test-Path -LiteralPath $file)) { throw "Missing generated pack file: $file" }
}
Compress-Archive -LiteralPath $files -DestinationPath $destination -Force
Write-Output $destination
