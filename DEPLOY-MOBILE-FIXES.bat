@echo off
echo ========================================
echo DEPLOYING MOBILE FIXES
echo ========================================
echo.
echo Fixes included:
echo [1] Two-finger rotation - Smooth 360 degrees rotation
echo [2] GPS arrow direction - Uses phone compass
echo [3] Responsive buttons - No overlapping on Android
echo.
cd /d "%~dp0"
git add js/map.js js/gps.js css/style.css
git commit -m "Mobile fixes: rotation, GPS arrow, responsive buttons"
git push origin main
echo.
echo ========================================
echo DEPLOYED! Wait 2 minutes then test:
echo https://d4k4n.github.io/household-tracker/
echo ========================================
echo.
echo Test on your Android phone:
echo [√] 1 finger = Pan map
echo [√] 2 fingers pinch = Zoom
echo [√] 2 fingers rotate = Rotate 360 degrees
echo [√] GPS arrow points where phone faces
echo [√] All buttons visible, no overlapping
echo.
pause
