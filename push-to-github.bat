@echo off
echo ========================================
echo   Pushing to GitHub
echo ========================================
echo.

cd /d "%~dp0"

echo Initializing git repository...
git init

echo.
echo Adding all files...
git add .

echo.
echo Committing files...
git commit -m "Complete Household GPS Water Meter Tracker - Stages 1-7"

echo.
echo Setting branch to main...
git branch -M main

echo.
echo Adding remote origin...
git remote add origin https://github.com/D4K4N/household-tracker.git

echo.
echo Pushing to GitHub...
git push -u origin main

echo.
echo ========================================
echo   Done!
echo ========================================
pause
