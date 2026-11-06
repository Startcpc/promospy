@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel% equ 0 (
  py -3 start.py %*
) else (
  python start.py %*
)
if errorlevel 1 pause
