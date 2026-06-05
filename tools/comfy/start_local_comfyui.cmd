@echo off
setlocal

set "ROOT=D:\AI\ComfyUI_windows_portable"
set "SCRIPT=E:\BaiduNetdiskDownload\sulphur2-comfyui-video-package\sulphur2-comfyui-video-package\sulphur2-comfyui-video\scripts\start_sulphur2_comfyui.ps1"
set "URL=http://127.0.0.1:8190/"

if not exist "%SCRIPT%" (
    echo Missing start script:
    echo %SCRIPT%
    pause
    exit /b 1
)

powershell -ExecutionPolicy Bypass -File "%SCRIPT%" -Root "%ROOT%" -Port 8190 -ReserveVramGb 5
if errorlevel 1 (
    echo.
    echo ComfyUI failed to start. Press any key to close this window.
    pause >nul
    exit /b 1
)

start "" "%URL%"
exit /b 0
