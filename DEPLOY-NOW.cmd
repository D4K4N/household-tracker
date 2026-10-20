@echo off
echo ================================
echo DEPLOYING ALL FIXES
echo ================================
cd /d "%~dp0"
git add .
git commit -m "Fix: Encryption optional + Markers appear + Layout arranged + Mobile controls + Start billing system"
git push origin main
echo.
echo ================================
echo DEPLOYED! Wait 1-2 minutes
echo ================================
echo Test at: https://d4k4n.github.io/household-tracker/
pause
