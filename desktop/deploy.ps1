$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
$project=Split-Path $PSScriptRoot -Parent
$source=Join-Path $project 'release\汇报工作台-Windows-x64'
$installed='D:\PresentationStudio'
$backup=Join-Path $project ('docs\deployment-backup\'+[DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss'))
if (@(Get-Process -Name '汇报工作台' -ErrorAction SilentlyContinue).Count) {throw 'Close the application normally before deployment.'}
if ((Resolve-Path -LiteralPath $installed).Path -cne 'D:\PresentationStudio') {throw 'Unexpected installation path'}
if (-not (Test-Path -LiteralPath "$installed\汇报工作台.exe")) {throw 'Installed runtime not found'}
function ProjectHashes {
    @(Get-ChildItem -LiteralPath "$installed\data\projects","$installed\data\component-library" -File -Recurse | Sort-Object FullName | ForEach-Object {"$($_.FullName)|$((Get-FileHash -LiteralPath $_.FullName).Hash)"})
}
$dataBefore=ProjectHashes
$files=@()
$resourceItems=@()
foreach($part in @('resources\app','Agent教程')) {
    $resourceItems+=@(Get-ChildItem -LiteralPath (Join-Path $source $part) -Recurse -File)
}
$resourceItems+=Get-Item -LiteralPath (Join-Path $source '使用说明.txt')
    foreach($item in $resourceItems) {
        $relative=$item.FullName.Substring($source.Length+1)
        $target=Join-Path $installed $relative
        if (-not (Test-Path -LiteralPath $target)) {throw "Expected installed resource is missing: $relative"}
        $files += [pscustomobject]@{Relative=$relative;Before=(Get-FileHash -LiteralPath $target).Hash;After=(Get-FileHash -LiteralPath $item.FullName).Hash}
    }
New-Item -ItemType Directory -Path $backup -Force | Out-Null
$files | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backup 'manifest.json') -Encoding utf8
foreach($file in $files) {
    $copy=Join-Path $backup $file.Relative
    New-Item -ItemType Directory -Path (Split-Path $copy -Parent) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $installed $file.Relative) -Destination $copy
    if((Get-FileHash -LiteralPath $copy).Hash -ne $file.Before){throw 'Backup verification failed'}
}
try {
    foreach($file in $files) {
        $target=Join-Path $installed $file.Relative
        if((Get-FileHash -LiteralPath $target).Hash -ne $file.Before){throw 'Installed resource changed during deployment'}
        Copy-Item -LiteralPath (Join-Path $source $file.Relative) -Destination $target -Force
        if((Get-FileHash -LiteralPath $target).Hash -ne $file.After){throw 'Deployment verification failed'}
    }
    if(@(Compare-Object $dataBefore (ProjectHashes)).Count){throw 'Project data changed during deployment'}
} catch {
    foreach($file in $files){Copy-Item -LiteralPath (Join-Path $backup $file.Relative) -Destination (Join-Path $installed $file.Relative) -Force}
    throw
}
$version=(Get-Content -LiteralPath (Join-Path $source 'resources\app\package.json') -Raw | ConvertFrom-Json).version
$result=[pscustomobject]@{Version=$version;Installed=$installed;Backup=$backup;Files=$files.Count;ResourceHashesMatch=$true;ProjectDataUnchanged=$true}
$result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $project 'docs\deployment-result.json') -Encoding utf8
$result | ConvertTo-Json
