param([ValidatePattern('^kiberaz-releasefix-[a-zA-Z0-9-]+$')][string]$RunId='kiberaz-releasefix-20260917')
# Mövcud audit fikstürünün yeni, təcrid edilmiş nüsxəsi; əvvəlki baza dəyişmir.
$ErrorActionPreference='Stop'
$root=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$private=Join-Path ([IO.Path]::GetTempPath()) $RunId
$fixtureSource=Join-Path $private 'fixture-source'
if (Test-Path -LiteralPath (Join-Path $private 'runtime')) { throw 'Runtime artıq var; məlumat qorunur.' }
[IO.Directory]::CreateDirectory($fixtureSource) | Out-Null
$template=Get-Content -LiteralPath (Join-Path $root 'tools/PreDeployQa/Program.cs') -Raw
$old='const string runName = "20260917T-predeploy-132107";'
if (-not $template.Contains($old)) { throw 'Fikstür şablonu dəyişib; setup yenidən yoxlanmalıdır.' }
$template.Replace($old,('const string runName = "'+$RunId+'";')) | Set-Content -LiteralPath (Join-Path $fixtureSource 'Program.cs')
$projectPath=[Security.SecurityElement]::Escape((Join-Path $root 'Kiberaz.Infrastructure/Kiberaz.Infrastructure.csproj'))
$project='<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net9.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable></PropertyGroup><ItemGroup><FrameworkReference Include="Microsoft.AspNetCore.App" /><ProjectReference Include="'+$projectPath+'" /></ItemGroup></Project>'
$project | Set-Content -LiteralPath (Join-Path $fixtureSource 'Fixture.csproj')
dotnet run --project (Join-Path $fixtureSource 'Fixture.csproj') -- init (Join-Path $private 'runtime')
if ($LASTEXITCODE -ne 0) { throw 'Fikstür hazırlana bilmədi.' }
[IO.Directory]::CreateDirectory((Join-Path $private 'runtime/wwwroot')) | Out-Null
Write-Host 'İzolə fikstür hazırdır; hesab/config dəyərləri yalnız private temp-dədir.'
