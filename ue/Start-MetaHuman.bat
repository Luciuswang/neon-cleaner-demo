@echo off
echo Neon Cleaner - MetaHuman setup and start
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-MetaHuman.ps1"
if errorlevel 1 pause
