$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$sourcePath = Join-Path $repoRoot "public\app-icon.png"

if (-not (Test-Path $sourcePath)) {
  throw "Icon source not found: $sourcePath"
}

Add-Type -AssemblyName System.Drawing

function Save-ResizedPng {
  param(
    [System.Drawing.Image] $Source,
    [string] $Destination,
    [int] $Size,
    [double] $Scale = 1.0,
    [bool] $Transparent = $false
  )

  $directory = Split-Path -Parent $Destination
  if (-not (Test-Path $directory)) {
    New-Item -ItemType Directory -Path $directory | Out-Null
  }

  $bitmap = New-Object System.Drawing.Bitmap $Size, $Size
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)

  try {
    $graphics.Clear($(if ($Transparent) { [System.Drawing.Color]::Transparent } else { [System.Drawing.Color]::Black }))
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $drawSize = [Math]::Round($Size * $Scale)
    $offset = [Math]::Round(($Size - $drawSize) / 2)
    $graphics.DrawImage($Source, $offset, $offset, $drawSize, $drawSize)
    $bitmap.Save($Destination, [System.Drawing.Imaging.ImageFormat]::Png)
  } finally {
    $graphics.Dispose()
    $bitmap.Dispose()
  }
}

$source = [System.Drawing.Image]::FromFile($sourcePath)

try {
  Save-ResizedPng -Source $source -Destination (Join-Path $repoRoot "public\favicon.png") -Size 512
  Save-ResizedPng -Source $source -Destination (Join-Path $repoRoot "public\favicon-32x32.png") -Size 32
  Save-ResizedPng -Source $source -Destination (Join-Path $repoRoot "public\favicon-16x16.png") -Size 16
  Save-ResizedPng -Source $source -Destination (Join-Path $repoRoot "public\apple-touch-icon.png") -Size 180
  Save-ResizedPng -Source $source -Destination (Join-Path $repoRoot "public\icon-192.png") -Size 192
  Save-ResizedPng -Source $source -Destination (Join-Path $repoRoot "public\icon-512.png") -Size 512

  $legacySizes = @{
    "mipmap-mdpi" = 48
    "mipmap-hdpi" = 72
    "mipmap-xhdpi" = 96
    "mipmap-xxhdpi" = 144
    "mipmap-xxxhdpi" = 192
  }

  foreach ($entry in $legacySizes.GetEnumerator()) {
    $folder = Join-Path $repoRoot "android\app\src\main\res\$($entry.Key)"
    Save-ResizedPng -Source $source -Destination (Join-Path $folder "ic_launcher.png") -Size $entry.Value
    Save-ResizedPng -Source $source -Destination (Join-Path $folder "ic_launcher_round.png") -Size $entry.Value
  }

  $foregroundSizes = @{
    "mipmap-mdpi" = 108
    "mipmap-hdpi" = 162
    "mipmap-xhdpi" = 216
    "mipmap-xxhdpi" = 324
    "mipmap-xxxhdpi" = 432
  }

  foreach ($entry in $foregroundSizes.GetEnumerator()) {
    $folder = Join-Path $repoRoot "android\app\src\main\res\$($entry.Key)"
    Save-ResizedPng -Source $source -Destination (Join-Path $folder "ic_launcher_foreground.png") -Size $entry.Value -Scale 0.88 -Transparent $true
  }

  Write-Host "Icons generated from $sourcePath"
} finally {
  $source.Dispose()
}
