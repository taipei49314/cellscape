@echo off
cd /d "%~dp0"
echo CELLSCAPE
echo http://127.0.0.1:8642/
echo Close this window to stop the server.
start "" cmd /c "timeout /t 1 /nobreak >nul & start http://127.0.0.1:8642/"
python -m http.server 8642 --bind 127.0.0.1
