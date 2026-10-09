@echo off
cd /d "%~dp0"
echo ========================================
echo  Deploying 100%% Offline Mode
echo ========================================
echo.
echo Adding files...
git add js/offlineMaps.js js/app.js index.html
echo.
echo Committing...
git commit -m "Add 100%% offline mode - download maps once, work forever"
echo.
echo Pushing to GitHub...
git push origin main
echo.
echo ========================================
echo  DONE!
echo ========================================
echo.
echo Wait 2 minutes, then:
echo 1. Open app on phone
echo 2. Menu → Download Maps for Offline
echo 3. Wait 2-5 minutes for download
echo 4. Turn off data - app still works!
echo.
pause
