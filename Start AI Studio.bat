@echo off
title AI Watermark Remover Studio (GUI)
echo ========================================================
echo       Launch AI Watermark Remover Studio (GUI)
echo ========================================================
echo Starting local GUI Studio and opening browser...

set PYTHONPATH=src
if exist ".venv\Scripts\python.exe" (
    .venv\Scripts\python.exe -m remove_ai_watermarks.server --open
) else (
    python -m remove_ai_watermarks.server --open
)
pause
