@echo off
cd /d "%~dp0"
echo ========================================
echo  DEPLOYING: Arrow Navigation + Better Maps
echo ========================================
echo.
echo Changes:
echo  ✓ Blue circle changed to directional arrow
echo  ✓ Arrow shows which way you're facing
echo  ✓ Compass/heading tracking enabled
echo  ✓ Google Hybrid maps (satellite + labels)
echo  ✓ Zoom increased to level 22 (very close)
echo  ✓ Better map tiles loaded
echo.
pause
echo.
git add js/map.js js/gps.js js/app.js
git commit -m "Add directional arrow + compass + better maps - Change blue circle to arrow showing direction - Add device compass heading tracking - Switch to Google Hybrid maps (satellite + labels) - Increase max zoom to 22 for closer view - Add multiple map layer options"
git push origin main
echo.
echo ========================================
echo  DONE!
echo ========================================
echo.
echo Wait 2 minutes, then test on phone:
echo https://d4k4n.github.io/household-tracker/
echo.
echo Clear cache: Ctrl+Shift+R
echo.
echo New features:
echo  → Blue arrow points where you're facing
echo  → Zoom in much closer to houses
echo  → Better satellite imagery
echo  → Choose: Google Hybrid/Satellite/Street/Esri
echo ========================================
pause
