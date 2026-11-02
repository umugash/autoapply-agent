@echo off
title Antigravity AutoApply AI Agent
echo Starting Antigravity AutoApply AI Agent...
cd /d "%~dp0"
call venv\Scripts\activate.bat
python run.py
pause
