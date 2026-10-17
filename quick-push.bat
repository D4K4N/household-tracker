@echo off
cd /d "%~dp0"
git add .
git commit -m "Fix: Mobile controls + encryption optional + thermal template"
git push origin main
echo.
echo Done! Fixes Deployed:
echo - Two-finger map rotation fixed
echo - GPS compass arrow follows phone orientation
echo - Responsive floating buttons (no overlap)
echo - Thermal printer matches Dicklum template
echo - App locked error FIXED (encryption now optional)
echo.
echo App URL: https://d4k4n.github.io/household-tracker/
echo.
echo Wait 1-2 minutes then refresh your phone!
pause
