@echo off
cd /d "%~dp0"
echo ========================================
echo  Deploying Map Fixes + Phase 8
echo ========================================
echo.
echo Changes:
echo  - Satellite view toggle added
echo  - Fixed popup behavior (stays open)
echo  - Fixed search navigation
echo  - Database syntax error fixed
echo  - Bill printing integrated
echo  - Offline map detection
echo.
echo Adding all changes...
git add .
echo.
echo Committing...
git commit -m "Add satellite view + Fix popup behavior + Phase 8 complete - Add Map/Satellite layer toggle in top-right - Fix popups to stay open (don't close on touch) - Fix search navigation popup visibility - Enhance close button for mobile - Fix database.js syntax error - Add thermal bill printing service - Add offline map detection notification"
echo.
echo Pushing to GitHub...
git push origin main
echo.
echo ========================================
echo  Deployment Complete!
echo ========================================
echo.
echo Test at: https://d4k4n.github.io/household-tracker/
echo.
echo IMPORTANT: Hard refresh browser (Ctrl+Shift+R)
echo to see new changes!
echo.
echo New Features:
echo  1. Layer control (top-right) - switch Map/Satellite
echo  2. Popups stay open - only X button closes them
echo  3. Search works - popup stays visible
echo  4. Bill printing ready to test
echo ========================================
pause
