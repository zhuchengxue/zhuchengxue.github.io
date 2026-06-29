@echo off
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 goto no_node
if "%~1"=="--foreground" goto foreground
start "" /min node.exe scripts\writing-dashboard.mjs
exit /b 0

:foreground
node.exe scripts\writing-dashboard.mjs --no-open --port=4179
exit /b %errorlevel%

:no_node
echo Node.js is required. Install it from https://nodejs.org/
pause
exit /b 1
