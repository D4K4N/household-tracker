@echo off
cd /d "%~dp0"
echo Adding all changes to git...
git add .
echo.
echo Committing changes...
git commit -m "Complete route recording feature with marker clustering - Fix lag with many pins - Add house-to-house GPS route tracking - Integrate Leaflet.markercluster for performance - Upgrade database to v2 (preserves existing household data) - Add route recording UI controls with pause/resume/save"
echo.
echo Pushing to GitHub...
git push origin main
echo.
echo Done! Check https://d4k4n.github.io/household-tracker/
pause
