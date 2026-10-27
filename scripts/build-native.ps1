$ErrorActionPreference='Stop'
$projectRoot=Split-Path $PSScriptRoot -Parent
$compiler=Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe'
$output=Join-Path $projectRoot 'native\bin'
New-Item -ItemType Directory -Path $output -Force | Out-Null
$launchSource=Join-Path $projectRoot 'native\DirectLaunch.cs'
$launchBinary=Join-Path $output 'SampForge.DirectLaunch.exe'
if(!(Test-Path -LiteralPath $launchBinary) -or (Get-Item -LiteralPath $launchSource).LastWriteTimeUtc -gt (Get-Item -LiteralPath $launchBinary).LastWriteTimeUtc){
& $compiler /nologo /target:exe /platform:x86 /optimize+ "/out:$output\SampForge.DirectLaunch.exe" (Join-Path $projectRoot 'native\DirectLaunch.cs')
if($LASTEXITCODE -ne 0){throw 'Fallo al compilar el iniciador.'}
}
& $compiler /nologo /target:exe /platform:x86 /optimize+ /r:System.Web.Extensions.dll "/resource:$projectRoot\samp-versions.json,SampVersions.json" "/resource:$projectRoot\client-payloads.json,ClientPayloads.json" "/resource:$projectRoot\native\ClientLicenses.txt,ClientLicenses.txt" "/out:$output\SampForge.GameSetup.exe" (Join-Path $projectRoot 'native\ClientSetup.cs') (Join-Path $projectRoot 'native\MultiClient.cs')
if($LASTEXITCODE -ne 0){throw 'Fallo al compilar el instalador SA-MP.'}
New-Item -ItemType Directory -Path (Join-Path $output '7zip') -Force | Out-Null
Copy-Item -Path (Join-Path $projectRoot 'vendor\7zip\*') -Destination (Join-Path $output '7zip') -Force
