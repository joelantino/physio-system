@echo off
title PhysioAI Backend Server
color 0A
echo.
echo ============================================================
echo   PhysioAI Backend Server - FastAPI + MediaPipe
echo ============================================================
echo.
echo Starting server on http://localhost:8000
echo Video stream: http://localhost:8000/stream
echo API Docs:     http://localhost:8000/docs
echo.
cd /d "%~dp0backend"
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
pause
