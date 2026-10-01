@echo off
echo ========================================
echo   Household Tracker - Starting Server
echo ========================================
echo.
echo Finding your computer's IP address...
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4 Address"') do (
    set IP=%%a
    set IP=!IP:~1!
    echo Your IP Address: !IP!
    echo.
    echo On your phone, open: http://!IP!:8080
    echo.
)
echo.
echo Starting server on port 5500...
echo Press Ctrl+C to stop the server
echo.
node server.js
