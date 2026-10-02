@echo off
cd /d "%~dp0"
git add .
git commit -m "Fix offline map + add GPS route guidance"
git push origin main
echo.
echo Done! Changes:
echo - Simple offline map (OpenStreetMap)
echo - Blue GPS marker follows you
echo - GPS path shows where you walked
echo - Red dashed line shows route to household
echo - Distance shown when you select household
echo.
echo Wait 1-2 minutes then refresh your phone!
pause
