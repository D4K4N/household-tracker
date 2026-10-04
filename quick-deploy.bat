@echo off
echo Deploying fixes...
git add js/app.js js/households.js js/waterMeterLocations.js
git commit -m "Fix popup visibility + Hide meter locations by default"
git push origin main
echo.
echo Done! Wait 1-2 minutes for GitHub Pages to update.
echo Then hard refresh: Ctrl+Shift+R
pause
