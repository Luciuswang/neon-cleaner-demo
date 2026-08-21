@echo off
setlocal

set "ROOT=%~dp0"
set "GAME=%ROOT%Builds\Windows\NeonCleanerUE.exe"

if not exist "%GAME%" (
  echo Packaged build not found:
  echo %GAME%
  echo.
  echo Build it from Unreal Editor or run the BuildCookRun command documented in NeonCleanerUE\Docs\Day1-PC-Prototype.md.
  pause
  exit /b 1
)

start "" "%GAME%" -windowed -ResX=1280 -ResY=720
