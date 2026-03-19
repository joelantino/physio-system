@echo off
title PhysioAI Frontend - React Dev Server
color 0B
echo.
echo ============================================================
echo   PhysioAI Frontend - React + Vite
echo ============================================================
echo.
echo Starting frontend on http://localhost:5173
echo.
cd /d "%~dp0frontend"
npm run dev
pause
