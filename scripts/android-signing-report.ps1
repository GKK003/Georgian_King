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

$env:PATH = "$env:JAVA_HOME\bin;$env:PATH"

Push-Location $androidDir
try {
  .\gradlew.bat signingReport
} finally {
  Pop-Location
}
