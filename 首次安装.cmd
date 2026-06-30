@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node.exe >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js LTS，然后重新双击本文件。
  echo https://nodejs.org/
  pause
  exit /b 1
)
where git.exe >nul 2>nul
if errorlevel 1 (
  echo 请先安装 GitHub Desktop，然后重新双击本文件。
  echo https://desktop.github.com/
  pause
  exit /b 1
)
echo 正在安装学语思发布器，请稍候……
call npm.cmd ci
if errorlevel 1 (
  echo 安装失败，请检查网络后重试。
  pause
  exit /b 1
)
echo.
echo 安装完成。以后只需双击“发布文章.cmd”。
pause
