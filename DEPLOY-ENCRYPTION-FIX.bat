@echo off
echo ========================================
echo DEPLOYING ENCRYPTION FIX
echo ========================================
echo.

cd /d "%~dp0"

echo Adding files...
git add js/database.js js/map.js js/gps.js js/printer.js css/style.css index.html quick-push.bat DEPLOY_FIX.md

echo.
echo Committing...
git commit -m "Fix: Mobile controls + encryption optional - all fixes complete"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Fixed Issues:
echo  1. Two-finger map rotation - FIXED
echo  2. GPS compass arrow orientation - FIXED
echo  3. Responsive floating buttons - FIXED
echo  4. Thermal printer template - UPDATED
echo  5. App locked error - FIXED (encryption optional)
echo.
echo App URL: https://d4k4n.github.io/household-tracker/
echo.
echo IMPORTANT: Wait 1-2 minutes for GitHub Pages to rebuild
echo Then refresh your phone browser (hard refresh)
echo.
pause
