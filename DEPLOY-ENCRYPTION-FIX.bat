@echo off
echo ========================================
echo DEPLOYING ALL FIXES - MARKERS + LAYOUT
echo ========================================
echo.

cd /d "%~dp0"

echo Adding files...
git add js/database.js js/map.js js/gps.js js/printer.js js/households.js js/waterMeterLocations.js css/style.css index.html

echo.
echo Committing...
git commit -m "Complete fixes: Encryption optional + Mobile controls + Markers display + Layout arranged"

echo.
echo Pushing to GitHub...
git push origin main

echo.
echo ========================================
echo DEPLOYMENT COMPLETE!
echo ========================================
echo.
echo Fixed Issues:
echo  1. App locked error - FIXED (encryption optional)
echo  2. Two-finger map rotation - FIXED
echo  3. GPS compass arrow orientation - FIXED  
echo  4. Responsive floating buttons - FIXED
echo  5. Thermal printer template - UPDATED
echo  6. Markers not appearing - FIXED (auto-show on add)
echo  7. Bottom button layout - FIXED (side-by-side)
echo.
echo App URL: https://d4k4n.github.io/household-tracker/
echo.
echo IMPORTANT: Wait 1-2 minutes for GitHub Pages to rebuild
echo Then refresh your phone browser (hard refresh)
echo.
echo Test: Add a household - red marker should appear immediately!
echo Test: Add meter location - blue marker should appear immediately!
echo.
pause
