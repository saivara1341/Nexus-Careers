@echo off
set "JAVA_HOME=C:\Program Files\Java\jdk-22"
echo Using JAVA_HOME=%JAVA_HOME% > build_log.txt
echo checking java version... >> build_log.txt
"%JAVA_HOME%\bin\java.exe" -version >> build_log.txt 2>&1
echo. >> build_log.txt
echo Starting build... >> build_log.txt
call gradlew.bat assembleDebug --stacktrace --info >> build_log.txt 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Build failed with error level %ERRORLEVEL% >> build_log.txt
    exit /b %ERRORLEVEL%
)
echo Build successful >> build_log.txt
