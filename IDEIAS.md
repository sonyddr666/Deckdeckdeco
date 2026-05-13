param(
  [switch]$SkipSdk
)

$ErrorActionPreference = "Stop"
$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$PluginName = "com.ulanzi.deckdeckdeco.ulanziPlugin"
$PluginsDir = Join-Path $env:APPDATA "Ulanzi\UlanziDeck\Plugins"
$Dest = Join-Path $PluginsDir $PluginName

Write-Host "DeckDeckDeco setup iniciado" -ForegroundColor Cyan
Write-Host "Projeto: $Root"

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw "Node.js nao foi encontrado. Instale Node 18+ antes de continuar."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm nao foi encontrado. Instale Node.js com npm."
}

if (-not $SkipSdk) {
  if (-not (Test-Path (Join-Path $Root "plugin-common-node-direct"))) {
    Write-Host "Clonando plugin-common-node..." -ForegroundColor Cyan
    git clone https://github.com/UlanziTechnology/plugin-common-node.git (Join-Path $Root "plugin-common-node-direct")
  }

  if (-not (Test-Path (Join-Path $Root "plugin-common-html-direct"))) {
    Write-Host "Clonando plugin-common-html..." -ForegroundColor Cyan
    git clone https://github.com/UlanziTechnology/plugin-common-html.git (Join-Path $Root "plugin-common-html-direct")
  }

  Write-Host "Copiando SDK Node para plugin\ulanzi-api..." -ForegroundColor Cyan
  New-Item -ItemType Directory -Force (Join-Path $Root "plugin\ulanzi-api") | Out-Null
  Remove-Item (Join-Path $Root "plugin\ulanzi-api\*") -Recurse -Force -ErrorAction SilentlyContinue
  Copy-Item (Join-Path $Root "plugin-common-node-direct\index.js") (Join-Path $Root "plugin\ulanzi-api\") -Force
  Copy-Item (Join-Path $Root "plugin-common-node-direct\libs") (Join-Path $Root "plugin\ulanzi-api\") -Recurse -Force

  Write-Host "Copiando SDK HTML para libs..." -ForegroundColor Cyan
  New-Item -ItemType Directory -Force (Join-Path $Root "libs") | Out-Null
  Remove-Item (Join-Path $Root "libs\*") -Recurse -Force -ErrorAction SilentlyContinue
  foreach ($folder in @("css", "js", "assets")) {
    $source = Join-Path $Root "plugin-common-html-direct\$folder"
    if (Test-Path $source) {
      Copy-Item $source (Join-Path $Root "libs\") -Recurse -Force
    }
  }
}

$config = Join-Path $Root "config\deckdeckdeco.config.json"
$example = Join-Path $Root "config\deckdeckdeco.config.example.json"
if (-not (Test-Path $config) -and (Test-Path $example)) {
  Copy-Item $example $config -Force
  Write-Host "Config criada: config\deckdeckdeco.config.json" -ForegroundColor Green
}

Write-Host "Instalando dependencias npm no projeto..." -ForegroundColor Cyan
Push-Location $Root
npm install
Pop-Location

Write-Host "Instalando plugin local no Ulanzi Studio..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force $PluginsDir | Out-Null
if (Test-Path $Dest) {
  Remove-Item $Dest -Recurse -Force
}
New-Item -ItemType Directory -Force $Dest | Out-Null

$skip = @(".git", "UlanziDeckPlugin-SDK", "plugin-common-node-direct", "plugin-common-html-direct", "node_modules")
Get-ChildItem $Root | Where-Object { $skip -notcontains $_.Name } | ForEach-Object {
  Copy-Item $_.FullName $Dest -Recurse -Force
}

Write-Host "Instalando dependencias npm dentro do plugin instalado..." -ForegroundColor Cyan
Push-Location $Dest
npm install --omit=dev
Pop-Location

Write-Host "Pronto. Abra/reinicie o Ulanzi Studio." -ForegroundColor Green
Write-Host "Plugin instalado em: $Dest" -ForegroundColor Green
