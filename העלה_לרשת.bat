@echo off
title Vercel Update System
echo ============================================
echo    Website Update Uploader
echo ============================================
echo.
echo Preparing files for update...
git add .

set /p commitMsg="Enter short description (or press Enter for auto): "
if "%commitMsg%"=="" set commitMsg="Auto Update"

echo.
echo Saving update...
git commit -m "%commitMsg%"

echo.
echo Uploading to GitHub and Vercel...
git push

echo.
echo ============================================
echo Upload successful!
echo Vercel will update the site automatically in ~2 minutes.
echo ============================================
pause
