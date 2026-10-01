@echo off
echo ========================================
echo   Pushing to GitHub
echo ========================================
echo.

cd /d "%~dp0"

echo Adding all files (including database.js)...
git add .

echo.
echo Committing files...
git commit -m "Add missing database.js - Complete application"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo   Done!
echo ========================================
pause
