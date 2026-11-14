[CmdletBinding()]
param(
  [string]$OllamaUrl = 'http://127.0.0.1:11434',
  [string]$PrimaryModel = 'deepseek-r1:8b',
  [string]$SecondaryModel = 'qwen3.5:4b',
  [switch]$RunInference
)

$ErrorActionPreference = 'Stop'

function Test-LoopbackAddress([string]$Address) {
  return $Address -in @('127.0.0.1', '::1')
}

$result = [ordered]@{
  checked_at = (Get-Date).ToUniversalTime().ToString('o')
  ready = $false
  gpu = $null
  ollama = $null
  listener = $null
  models = @()
  checks = @()
}

try {
  $gpuLine = & nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>$null | Select-Object -First 1
  if (-not $gpuLine) { throw 'No NVIDIA GPU was reported.' }
  $result.gpu = $gpuLine.Trim()
  $result.checks += 'gpu_detected'

  $uri = [Uri]$OllamaUrl
  if ($uri.Scheme -ne 'http' -or $uri.Host -notin @('127.0.0.1', 'localhost', '::1') -or $uri.Port -ne 11434) {
    throw 'Local qualification only permits Ollama on loopback port 11434.'
  }

  $listener = Get-NetTCPConnection -LocalPort 11434 -State Listen | Select-Object -First 1
  if (-not $listener -or -not (Test-LoopbackAddress $listener.LocalAddress)) {
    throw 'Ollama must listen only on 127.0.0.1 or ::1.'
  }
  $result.listener = "$($listener.LocalAddress):$($listener.LocalPort)"
  $result.checks += 'loopback_only'

  $version = Invoke-RestMethod -Uri "$OllamaUrl/api/version" -Method Get -TimeoutSec 10
  $result.ollama = $version.version
  $result.checks += 'ollama_healthy'

  $tags = Invoke-RestMethod -Uri "$OllamaUrl/api/tags" -Method Get -TimeoutSec 15
  $result.models = @($tags.models | ForEach-Object { $_.name })
  foreach ($required in @($PrimaryModel, $SecondaryModel, 'nomic-embed-text:latest')) {
    if ($result.models -notcontains $required) { throw "Required model is missing: $required" }
  }
  $result.checks += 'required_models_present'

  if ($RunInference) {
    foreach ($model in @($PrimaryModel, $SecondaryModel)) {
      $body = @{
        model = $model
        prompt = 'Return only the token TEAM47_OK. This is a synthetic infrastructure health check with no customer data.'
        stream = $false
        options = @{ temperature = 0; num_predict = 128 }
      } | ConvertTo-Json -Depth 4
      $response = Invoke-RestMethod -Uri "$OllamaUrl/api/generate" -Method Post -ContentType 'application/json' -Body $body -TimeoutSec 120
      $generated = ([string]$response.response) + ([string]$response.thinking)
      if ([string]::IsNullOrWhiteSpace($generated)) { throw "Model returned no output: $model" }
      $result.checks += "inference:$model"
    }
  }

  $result.ready = $true
} catch {
  $result.error = $_.Exception.Message
}

$result | ConvertTo-Json -Depth 6
if (-not $result.ready) { exit 1 }
