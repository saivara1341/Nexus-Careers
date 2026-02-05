@echo off
setlocal
echo ===========================================
echo Nexus Mobile - Fix & Build
echo ===========================================
echo.
echo Your JAVA_HOME was pointing to '\bin' incorrectly.
echo Fixing it for this session...
echo.

set "JAVA_HOME=C:\Program Files\Java\jdk-22"
set "PATH=%JAVA_HOME%\bin;%PATH%"

echo JAVA_HOME is now: %JAVA_HOME%
echo.
echo Starting Build...
echo.

call build_easy.bat
