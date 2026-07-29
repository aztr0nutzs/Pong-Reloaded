$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$wrapperProperties = Join-Path $repoRoot "gradle\wrapper\gradle-wrapper.properties"
$wrapperJar = Join-Path $repoRoot "gradle\wrapper\gradle-wrapper.jar"
$tempDirectory = $null

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    if (-not (Test-Path -LiteralPath $wrapperProperties -PathType Leaf)) {
        throw "Missing $wrapperProperties."
    }

    $distributionLine = Get-Content -LiteralPath $wrapperProperties |
        Where-Object { $_ -match '^distributionUrl=' } |
        Select-Object -First 1
    if (-not $distributionLine) {
        throw "distributionUrl is missing from $wrapperProperties."
    }

    $distributionUrl = ($distributionLine -replace '^distributionUrl=', '') -replace '\\:', ':'
    if ($distributionUrl -notmatch '^https://services\.gradle\.org/distributions/gradle-([0-9][0-9A-Za-z.-]*)-bin\.zip$') {
        throw "distributionUrl must be an official services.gradle.org Gradle binary distribution: $distributionUrl"
    }

    $gradleVersion = $Matches[1]
    $checksumUrl = "$distributionUrl.sha256"
    $tempDirectory = Join-Path ([System.IO.Path]::GetTempPath()) ("gradle-wrapper-bootstrap-" + [System.Guid]::NewGuid())
    $distributionZip = Join-Path $tempDirectory "gradle-$gradleVersion-bin.zip"
    $checksumFile = "$distributionZip.sha256"
    New-Item -ItemType Directory -Path $tempDirectory | Out-Null

    Write-Host "Downloading official Gradle $gradleVersion distribution from $distributionUrl"
    try {
        Invoke-WebRequest -Uri $distributionUrl -OutFile $distributionZip
        Invoke-WebRequest -Uri $checksumUrl -OutFile $checksumFile
    }
    catch {
        throw "Official Gradle download failed: $($_.Exception.Message)"
    }

    $expectedChecksum = ((Get-Content -LiteralPath $checksumFile -Raw).Trim() -split '\s+')[0]
    if ($expectedChecksum -notmatch '^[0-9a-fA-F]{64}$') {
        throw "Official checksum response is not a valid SHA-256 value."
    }

    $actualChecksum = (Get-FileHash -LiteralPath $distributionZip -Algorithm SHA256).Hash
    if ($actualChecksum -ne $expectedChecksum) {
        throw "Gradle distribution checksum mismatch: expected $expectedChecksum, got $actualChecksum."
    }
    Write-Host "Verified Gradle distribution SHA-256: $($expectedChecksum.ToLowerInvariant())"

    try {
        Expand-Archive -LiteralPath $distributionZip -DestinationPath $tempDirectory
    }
    catch {
        throw "Failed to extract the verified Gradle distribution: $($_.Exception.Message)"
    }

    $gradleExecutable = Join-Path $tempDirectory "gradle-$gradleVersion\bin\gradle.bat"
    if (-not (Test-Path -LiteralPath $gradleExecutable -PathType Leaf)) {
        throw "Verified distribution does not contain the expected Gradle executable."
    }

    Write-Host "Generating the official Gradle $gradleVersion wrapper files."
    Push-Location $repoRoot
    try {
        & $gradleExecutable --no-daemon wrapper --gradle-version $gradleVersion --distribution-type bin
        if ($LASTEXITCODE -ne 0) {
            throw "Gradle wrapper generation exited with code $LASTEXITCODE."
        }
        if (-not (Test-Path -LiteralPath $wrapperJar -PathType Leaf)) {
            throw "Gradle completed without generating $wrapperJar."
        }

        Write-Host "Validating the generated repository wrapper."
        & ".\gradlew.bat" --version
        if ($LASTEXITCODE -ne 0) {
            throw "Generated wrapper validation exited with code $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }

    Write-Host "Gradle wrapper bootstrap completed. The generated JAR is local and ignored by Git."
}
catch {
    Write-Error "Gradle wrapper bootstrap failed: $($_.Exception.Message)"
    exit 1
}
finally {
    if ($tempDirectory -and (Test-Path -LiteralPath $tempDirectory)) {
        Remove-Item -LiteralPath $tempDirectory -Recurse -Force
    }
}
