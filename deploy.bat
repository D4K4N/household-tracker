@echo off
cd /d "%~dp0"

echo ========================================
echo  Household Tracker - Deploy to GitHub
echo ========================================
echo.

echo [1/3] Staging all changes...
git add .

echo.
echo [2/3] Committing...
git commit -m "Complete route recording + marker clustering"

echo.
echo [3/3] Pushing to GitHub Pages...
git push origin main

echo.
echo ========================================
echo  Deploy Complete!
echo  Live at: https://d4k4n.github.io/household-tracker/
echo ========================================
echo.
echo Your household data is safe!
echo IndexedDB data persists through updates.
echo.
pause
