@echo off
setlocal enabledelayedexpansion
echo ================================================
echo  ACE Sales App - Build and Deploy
echo ================================================
echo.

:: ── Config ──────────────────────────────────────────────────────────────────
set NODE_TLS_REJECT_UNAUTHORIZED=0
set PROJECT=C:\Users\tsahic\Projects\AceSalesNew
set ANDROID=%PROJECT%\android
set APK_DIR=%ANDROID%\app\build\outputs\apk\release
set ADB=C:\Users\tsahic\AppData\Local\Android\Sdk\platform-tools\adb.exe
set GRADLE=%ANDROID%\gradlew.bat
set BUILD_GRADLE=%ANDROID%\app\build.gradle

:: ── Step 1: Bump version ─────────────────────────────────────────────────────
echo [1/4] Bumping version...
powershell -ExecutionPolicy Bypass -File "%PROJECT%\bump_version.ps1" -BuildGradle "%BUILD_GRADLE%"
echo    Version bumped!
echo.

:: ── Step 2: Clear all caches ─────────────────────────────────────────────────
echo [2/4] Clearing caches...
cd /d %PROJECT%
if exist "%TEMP%\metro-cache" rmdir /s /q "%TEMP%\metro-cache"
if exist "%PROJECT%\node_modules\.cache" rmdir /s /q "%PROJECT%\node_modules\.cache"
cd /d %ANDROID%
call %GRADLE% clean
cd /d %PROJECT%
echo    Caches cleared!
echo.

:: ── Step 3: Build Android APK ───────────────────────────────────────────────
echo [3/4] Building Android APK...
cd /d %ANDROID%
call %GRADLE% assembleRelease
if %errorlevel% neq 0 ( echo ERROR: Android build failed! & pause & exit /b 1 )
cd /d %PROJECT%
echo    Android build complete!
echo.

:: ── Step 4: Install APK on device ───────────────────────────────────────────
echo [4/4] Installing APK on device...
set LATEST_APK=
for /f "delims=" %%f in ('dir /b /od "%APK_DIR%\*.apk" 2^>nul') do set LATEST_APK=%%f
if "%LATEST_APK%"=="" ( echo ERROR: No APK found! & pause & exit /b 1 )
echo    Found: %LATEST_APK%
"%ADB%" devices
"%ADB%" install -r "%APK_DIR%\%LATEST_APK%"
if %errorlevel% neq 0 (
    echo WARNING: ADB install failed. Is USB debugging enabled?
    echo    Manual install: %APK_DIR%\%LATEST_APK%
) else (
    echo    APK installed successfully!
)
echo.

echo ================================================
echo  ALL DONE!
echo  APK: %APK_DIR%\%LATEST_APK%
echo ================================================
pause