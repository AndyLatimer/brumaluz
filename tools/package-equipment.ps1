$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$projectRoot=Split-Path -Parent $PSScriptRoot
$assetRoot=Join-Path $projectRoot 'src/assets/models'
$iconRoot=Join-Path $projectRoot 'src/assets/icons/weapons'
$manifest=Get-Content -LiteralPath (Join-Path $assetRoot 'items/equipment_manifest.json') -Raw | ConvertFrom-Json
$armor=@($manifest | Where-Object {$_.id.StartsWith('traje_')})
$jewels=@($manifest | Where-Object {$_.slot -in @('pendant','ring','trinket')})
$packages=@(
 @{Path='items/modular_equipment_glb.zip';Items=@($armor)+@($jewels)},
 @{Path='wardrobe/classes/class_outfits_glb.zip';Items=$armor},
 @{Path='items/accessories/accessories_glb.zip';Items=$jewels}
)
foreach($package in $packages){
 $stream=[System.IO.File]::Open((Join-Path $assetRoot $package.Path),[System.IO.FileMode]::Create)
 $archive=[System.IO.Compression.ZipArchive]::new($stream,[System.IO.Compression.ZipArchiveMode]::Create)
 try{
  foreach($item in $package.Items){
   [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $assetRoot $item.model),$item.model)|Out-Null
   [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $iconRoot ($item.id+'.png')),('icons/'+$item.id+'.png'))|Out-Null
  }
  $entry=$archive.CreateEntry('equipment_manifest.json')
  $writer=[System.IO.StreamWriter]::new($entry.Open(),[System.Text.UTF8Encoding]::new($false))
  try{$writer.Write((ConvertTo-Json -InputObject @($package.Items) -Depth 20))}finally{$writer.Dispose()}
  foreach($file in @('docs/MODULAR-EQUIPMENT.md','docs/CLASS-OUTFITS.md','docs/EQUIPMENT-ART-DIRECTION.md','docs/EQUIPMENT-REFERENCE-STUDY.md','docs/WEAPON-SYSTEM-DESIGN.md','docs/MMORPG-SYSTEMS-REVIEW.md')){
   [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $projectRoot $file),([System.IO.Path]::GetFileName($file)))|Out-Null
  }
  if($package.Items.Count -gt $jewels.Count){
   [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $projectRoot 'art/equipment/brumaluz-headwear.blend'),'sources/brumaluz-headwear.blend')|Out-Null
  }
  foreach($file in @('wardrobe/classes/equipment_tailoring_closeup.png','wardrobe/classes/equipment_rarity_progression.png','wardrobe/classes/equipment_fit_review.png','wardrobe/classes/equipment_pose_review.png','wardrobe/classes/modular_equipment.png','items/accessories/accessories.png')){
   [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive,(Join-Path $assetRoot $file),([System.IO.Path]::GetFileName($file)))|Out-Null
  }
 }finally{$archive.Dispose();$stream.Dispose()}
 Write-Output "$($package.Path): $($package.Items.Count) GLB"
}
