param(
  [switch]$Build,
  [switch]$NoPull,
  [switch]$Open,
  [switch]$SkipHealthCheck
)

$ErrorActionPreference = 'Stop'
$ComposeFile = 'docker-compose.prod.yml'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $Root

function New-HexSecret([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  return (-join ($bytes | ForEach-Object { $_.ToString('x2') }))
}

function New-Base64Secret([int]$ByteCount) {
  $bytes = New-Object byte[] $ByteCount
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  $rng.GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

$script:EnvLines = $null

function Read-EnvFile {
  if (-not (Test-Path -LiteralPath '.env')) {
    if (-not (Test-Path -LiteralPath '.env.example')) {
      throw "Fichier .env.example introuvable."
    }
    Copy-Item -LiteralPath '.env.example' -Destination '.env'
    Write-Host "Fichier .env cree depuis .env.example."
  }

  $script:EnvLines = @(Get-Content -LiteralPath '.env')
}

function Get-EnvValue([string]$Name) {
  $pattern = '^' + [regex]::Escape($Name) + '='
  $line = $script:EnvLines | Where-Object { $_ -match $pattern } | Select-Object -First 1
  if (-not $line) {
    return ''
  }
  return $line.Substring($Name.Length + 1).Trim()
}

function Set-EnvValue([string]$Name, [string]$Value) {
  $pattern = '^' + [regex]::Escape($Name) + '='
  for ($i = 0; $i -lt $script:EnvLines.Count; $i++) {
    if ($script:EnvLines[$i] -match $pattern) {
      $script:EnvLines[$i] = "$Name=$Value"
      return
    }
  }
  $script:EnvLines += "$Name=$Value"
}

function Save-EnvFile {
  $content = (($script:EnvLines -join "`n") + "`n")
  $encoding = New-Object -TypeName System.Text.UTF8Encoding -ArgumentList $false
  [System.IO.File]::WriteAllText((Join-Path $Root '.env'), $content, $encoding)
}

function Resolve-ImagePrefix {
  $prefix = Get-EnvValue 'IMAGE_PREFIX'
  if ([string]::IsNullOrWhiteSpace($prefix) -or $prefix -match 'CHANGE_ME|your-github') {
    $owner = ''
    try {
      $remote = (& git remote get-url origin 2>$null)
      if ($remote -match 'github\.com[:/]([^/]+)/') {
        $owner = $Matches[1].ToLowerInvariant()
      }
    } catch {
      $owner = ''
    }
    if ([string]::IsNullOrWhiteSpace($owner)) {
      $owner = 'lionel-youassa'
    }
    $prefix = "ghcr.io/$owner"
    Set-EnvValue 'IMAGE_PREFIX' $prefix
  }
  return $prefix
}

function Initialize-LocalEnv {
  $original = (($script:EnvLines -join "`n") + "`n")

  if ((Get-EnvValue 'POSTGRES_USER') -match '^your_postgres_user$|^$') {
    Set-EnvValue 'POSTGRES_USER' 'kayydrive_user'
  }

  $password = Get-EnvValue 'POSTGRES_PASSWORD'
  if ([string]::IsNullOrWhiteSpace($password) -or $password -match '^your_postgres_password$') {
    Set-EnvValue 'POSTGRES_PASSWORD' (New-HexSecret 24)
  }

  $database = Get-EnvValue 'POSTGRES_DB'
  if ([string]::IsNullOrWhiteSpace($database) -or $database -match '^your_postgres_db$') {
    Set-EnvValue 'POSTGRES_DB' 'kayydrive_db'
    $database = 'kayydrive_db'
  }

  $databaseUrl = Get-EnvValue 'DATABASE_URL'
  if ([string]::IsNullOrWhiteSpace($databaseUrl) -or $databaseUrl -match 'your_postgres_') {
    $user = Get-EnvValue 'POSTGRES_USER'
    $pass = Get-EnvValue 'POSTGRES_PASSWORD'
    Set-EnvValue 'DATABASE_URL' "postgresql://$user`:$pass@postgres:5432/$database"
  }

  $jwt = Get-EnvValue 'JWT_SECRET'
  if ([string]::IsNullOrWhiteSpace($jwt) -or $jwt -match '^your_jwt_secret_key_change_in_production$|change_in_production') {
    Set-EnvValue 'JWT_SECRET' (New-Base64Secret 48)
  }

  if ([string]::IsNullOrWhiteSpace((Get-EnvValue 'CORS_ORIGINS'))) {
    Set-EnvValue 'CORS_ORIGINS' 'http://localhost:55555'
  }

  if ([string]::IsNullOrWhiteSpace((Get-EnvValue 'IMAGE_TAG'))) {
    Set-EnvValue 'IMAGE_TAG' 'latest'
  }

  if ([string]::IsNullOrWhiteSpace((Get-EnvValue 'ENVIRONMENT'))) {
    Set-EnvValue 'ENVIRONMENT' 'development'
  }

  Resolve-ImagePrefix | Out-Null

  $updated = (($script:EnvLines -join "`n") + "`n")
  if ($updated -ne $original) {
    Save-EnvFile
    Write-Host "Fichier .env initialise."
  }
}

try {
  & docker info *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "Docker n'est pas demarre. Lancez Docker Desktop puis relancez ce script."
  }

  Read-EnvFile
  Initialize-LocalEnv

  $imagePrefix = Get-EnvValue 'IMAGE_PREFIX'
  $imageTag = Get-EnvValue 'IMAGE_TAG'
  if ([string]::IsNullOrWhiteSpace($imageTag)) {
    $imageTag = 'latest'
  }

  $compose = @('compose', '-f', $ComposeFile, '--env-file', '.env')
  if (Test-Path -LiteralPath (Join-Path $Root 'osrm-data/cameroon-latest.osrm')) {
    $compose += @('--profile', 'osrm')
    Write-Host "Profil OSRM active."
  } else {
    Write-Host "Donnees OSRM absentes : service de navigation non demarre."
  }

  if ($Build) {
    Write-Host "Construction locale des images..."
    & docker build -t "$imagePrefix/kayydrive-core-api:$imageTag" (Join-Path $Root 'core-api')
    if ($LASTEXITCODE -ne 0) {
      throw "Echec de la construction de l'image core-api."
    }
    & docker build -t "$imagePrefix/kayydrive-ia-service:$imageTag" (Join-Path $Root 'ia-service')
    if ($LASTEXITCODE -ne 0) {
      throw "Echec de la construction de l'image ia-service."
    }
  } elseif (-not $NoPull) {
    Write-Host "Telechargement des images $imagePrefix/*:$imageTag..."
    & docker @compose pull
    if ($LASTEXITCODE -ne 0) {
      throw "Impossible de telecharger les images. Verifiez IMAGE_PREFIX, IMAGE_TAG et l'acces aux packages GHCR. Pour construire localement : .\start.ps1 -Build"
    }
  }

  Write-Host "Demarrage des services..."
  & docker @compose up -d
  if ($LASTEXITCODE -ne 0) {
    throw "Echec du demarrage Docker Compose."
  }

  $corePort = Get-EnvValue 'CORE_API_PORT'
  if ([string]::IsNullOrWhiteSpace($corePort)) {
    $corePort = '3200'
  }

  if (-not $SkipHealthCheck) {
    Write-Host "Attente de Core API sur http://localhost:$corePort/health..."
    $healthy = $false
    $deadline = (Get-Date).AddMinutes(4)
    while ((Get-Date) -lt $deadline) {
      try {
        $response = Invoke-WebRequest -Uri "http://localhost:$corePort/health" -UseBasicParsing -TimeoutSec 5
        if ($response.StatusCode -eq 200) {
          $healthy = $true
          break
        }
      } catch {
        Start-Sleep -Seconds 3
      }
    }

    if (-not $healthy) {
      & docker @compose logs --tail=100 migrate core-api
      throw "Core API n'est pas sain apres 4 minutes. Consultez les logs ci-dessus."
    }
  }

  Write-Host ""
  Write-Host "KayyDrive est demarre."
  Write-Host "Core API : http://localhost:$corePort"
  Write-Host "Swagger  : http://localhost:$corePort/api/docs"
  Write-Host "MinIO    : http://localhost:9001"
  Write-Host "Frontend : flutter run -d chrome --web-port=55555 --dart-define=API_URL=http://localhost:$corePort"

  if ($Open) {
    Start-Process "http://localhost:$corePort/api/docs"
  }
} catch {
  Write-Host "ERREUR: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}
