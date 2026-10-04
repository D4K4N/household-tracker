@echo off
echo ========================================
echo  CRITICAL FIX DEPLOYMENT
echo ========================================
git add js/database.js js/map.js css/style.css js/households.js js/waterMeterLocations.js js/app.js
git commit -m "CRITICAL FIX: Database syntax + Satellite view + Popup fixes"
git push origin main
echo.
echo Deployed! Wait 2 minutes for GitHub Pages rebuild.
pause
