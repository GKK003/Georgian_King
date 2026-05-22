$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
$androidDir = Join-Path $repoRoot "android"
$defaultJavaHome = "C:\Program Files\Android\Android Studio\jbr"
$defaultAndroidHome = Join-Path $env:LOCALAPPDATA "Android\Sdk"

if (-not $env:JAVA_HOME -and (Test-Path (Join-Path $defaultJavaHome "bin\java.exe"))) {
  $env:JAVA_HOME = $defaultJavaHome
}

if (-not $env:ANDROID_HOME -and (Test-Path $defaultAndroidHome)) {
  $env:ANDROID_HOME = $defaultAndroidHome
}

if (-not $env:JAVA_HOME -or -not (Test-Path (Join-Path $env:JAVA_HOME "bin\java.exe"))) {
  throw "Java was not found. Install Android Studio or set JAVA_HOME to Android Studio's jbr folder."
}

if (-not $env:ANDROID_HOME -or -not (Test-Path $env:ANDROID_HOME)) {
  throw "Android SDK was not found. Open Android Studio and install the Android SDK, then set ANDROID_HOME."
}

$env:PATH = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"

$sdkDir = $env:ANDROID_HOME.Replace("\", "/")
Set-Content -Path (Join-Path $androidDir "local.properties") -Value "sdk.dir=$sdkDir"

Push-Location $repoRoot
try {
  powershell -ExecutionPolicy Bypass -File (Join-Path $repoRoot "scripts\generate-icons.ps1")
  npm run build
  .\node_modules\.bin\cap.cmd sync android

  Push-Location $androidDir
  try {
    .\gradlew.bat assembleDebug
  } finally {
    Pop-Location
  }

  $apkSource = Join-Path $androidDir "app\build\outputs\apk\debug\app-debug.apk"
  $apkTarget = Join-Path $repoRoot "GeorgianKing-debug.apk"
  Copy-Item -LiteralPath $apkSource -Destination $apkTarget -Force

  Write-Host "APK created: $apkTarget"
} finally {
  Pop-Location
}
