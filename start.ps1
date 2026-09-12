Set-Location $PSScriptRoot
Write-Host 'CELLSCAPE Living Atlas'
Write-Host 'http://127.0.0.1:8642/loop.html'
Write-Host 'Close this window to stop the server.'
Start-Process cmd -ArgumentList '/c','timeout /t 1 /nobreak >nul & start http://127.0.0.1:8642/loop.html' -WindowStyle Hidden
python -m http.server 8642 --bind 127.0.0.1
