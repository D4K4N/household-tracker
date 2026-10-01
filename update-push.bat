@echo off
cd /d "%~dp0"
git add .
git commit -m "Add missing database.js file"
git push origin main
pause
