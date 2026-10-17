@echo off
echo ========================================
echo DEPLOYING MAP FIX TO GITHUB
echo ========================================
echo.
cd /d "%~dp0"
git add js/map.js
git commit -m "Fix map loading: delay rotation init for mobile compatibility"
git push origin main
echo.
echo ========================================
echo DEPLOYED! Wait 2 minutes for GitHub Pages
echo Then test on mobile:
echo https://d4k4n.github.io/household-tracker/
echo ========================================
echo.
echo Test these gestures:
echo - 1 finger = Pan/move map
echo - 2 fingers pinch = Zoom
echo - 2 fingers rotate = Rotate 360 degrees
echo.
pause
