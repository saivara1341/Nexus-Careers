@echo off
setlocal EnableDelayedExpansion

echo ===================================================
echo     Nexus Careers - APK Builder
echo ===================================================

set "SOURCE_DIR=%CD%"
set "TEMP_DIR=%TEMP%\nexus_safe_build"
set "APK_OUTPUT=%SOURCE_DIR%\nexus_careers.apk"

echo [*] Cleaning temp...
if exist "%TEMP_DIR%" rd /s /q "%TEMP_DIR%"
mkdir "%TEMP_DIR%"

echo [*] Copying files to %TEMP_DIR%...
xcopy "%SOURCE_DIR%" "%TEMP_DIR%" /E /I /H /Y /Q

echo.
echo [*] Starting Gradle Build...
echo.

cd /d "%TEMP_DIR%\android"

call gradlew.bat assembleDebug

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [X] BUILD FAILED!
    echo.
    echo Common fixes:
    echo 1. Ensure Java [JDK 17 or higher] is installed and JAVA_HOME is set.
    echo 2. Ensure Android SDK is installed.
    echo 3. Check your internet connection [Gradle needs to download dependencies].
    echo.
    echo Error details should be above.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [V] Build Success!
echo [*] Moving APK to: %APK_OUTPUT%

copy "app\build\outputs\apk\debug\app-debug.apk" "%APK_OUTPUT%"

echo.
echo Done. You can close this window.
pause
