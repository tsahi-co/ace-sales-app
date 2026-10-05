param([string]$BuildGradle)

$content = Get-Content $BuildGradle -Raw

# Read current values
$null = $content -match 'versionCode (\d+)'
$code = [int]$matches[1]

$null = $content -match 'versionName "([^"]+)"'
$name = $matches[1]

# Increment
$newCode = $code + 1
$parts = $name.Split('.')
$newName = $parts[0] + '.' + $parts[1] + '.' + ([int]$parts[2] + 1)

# Write back
$content = $content -replace "versionCode $code", "versionCode $newCode"
$content = $content -replace "versionName `"$name`"", "versionName `"$newName`""
Set-Content $BuildGradle $content -NoNewline

Write-Host "   $name (build $code) -> $newName (build $newCode)"