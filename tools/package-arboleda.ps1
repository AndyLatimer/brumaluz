$ErrorActionPreference = 'Stop'
$project = Split-Path $PSScriptRoot -Parent
$pack = Join-Path $project 'src/assets/library/brumaluz-arboleda'
$destination = Join-Path $project 'art/arboleda/brumaluz-arboleda-glb.zip'
Compress-Archive -LiteralPath @(
    (Join-Path $pack 'objects'),
    (Join-Path $pack 'textures'),
    (Join-Path $pack 'catalog.json'),
    (Join-Path $project 'art/arboleda/manifest.json'),
    (Join-Path $project 'art/arboleda/README.md')
) -DestinationPath $destination -CompressionLevel Optimal -Force
Get-Item -LiteralPath $destination | Select-Object FullName, Length
