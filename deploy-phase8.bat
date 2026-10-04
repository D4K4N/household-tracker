@echo off
cd /d "%~dp0"
echo ================================
echo  PHASE 8: Bill Printing Deploy
echo ================================
echo.
echo Adding all changes to git...
git add .
echo.
echo Committing changes...
git commit -m "Phase 8 Complete: Bill printing + Offline detection + Database fix - Add thermal bill printing with exact Dicklum template - Add offline map tile detection with notification - Fix database.js syntax error (missing closing brace) - Integrate PrinterService for formatted bills - Add map.js offline notification banner - Fix class definition structure in database.js"
echo.
echo Pushing to GitHub...
git push origin main
echo.
echo ================================
echo Done! 
echo.
echo Test at: https://d4k4n.github.io/household-tracker/
echo.
echo Remember to hard refresh (Ctrl+Shift+R) to clear cache!
echo ================================
pause
