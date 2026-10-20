param(
    [Parameter(Mandatory = $true)]
    [string]$SourceDirectory
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$destination = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.art-sources'))
$archives = @(
    'KayKit_ResourceBits_1.0_FREE',
    'KayKit_Forest_Nature_Pack_1.0_FREE',
    'KayKit_Adventurers_2.0_FREE',
    'KayKit_Skeletons_1.1_FREE',
    'KayKit_Dungeon_Pack_1.1_FREE'
)
foreach ($name in $archives) {
    $zip = [IO.Compression.ZipFile]::OpenRead((Join-Path $SourceDirectory "$name.zip"))
    try {
        $count = 0
        foreach ($entry in $zip.Entries) {
            $target = [IO.Path]::GetFullPath((Join-Path $destination $entry.FullName))
            $packRoot = Join-Path $destination $name
            if (-not $target.StartsWith("$packRoot\", [StringComparison]::OrdinalIgnoreCase) -and $target -ne $packRoot) {
                throw "Archive entry outside package: $($entry.FullName)"
            }
            if ($entry.Name -eq '') {
                [IO.Directory]::CreateDirectory($target) | Out-Null
            } else {
                [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
                [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $true)
                $count++
            }
        }
        Write-Output "${name}: $count files extracted"
    } finally {
        $zip.Dispose()
    }
}
