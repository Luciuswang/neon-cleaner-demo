@echo off
setlocal

set "ROOT=D:\AI\ComfyUI_windows_portable"
set "SCRIPT=E:\BaiduNetdiskDownload\sulphur2-comfyui-video-package\sulphur2-comfyui-video-package\sulphur2-comfyui-video\scripts\start_sulphur2_comfyui.ps1"
set "URL=http://127.0.0.1:8190/"
set "PROFILE_DIR=D:\AI\ComfyUI_browser_profile"
set "EDGE_EXE=C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"

if not exist "%SCRIPT%" (
    echo Missing start script:
    echo %SCRIPT%
    pause
    exit /b 1
)

if not exist "%PROFILE_DIR%" mkdir "%PROFILE_DIR%"

powershell -ExecutionPolicy Bypass -File "%SCRIPT%" -Root "%ROOT%" -Port 8190 -ReserveVramGb 5
if errorlevel 1 (
    echo.
    echo ComfyUI failed to start. Press any key to close this window.
    pause >nul
    exit /b 1
)

if exist "%EDGE_EXE%" (
    start "" "%EDGE_EXE%" --user-data-dir="%PROFILE_DIR%" --new-window "%URL%"
) else (
    start "" "%URL%"
)

exit /b 0
