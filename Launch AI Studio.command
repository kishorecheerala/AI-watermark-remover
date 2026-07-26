#!/usr/bin/env zsh
DIR="$( cd "$( dirname "${BASH_SOURCE[0]:-$0}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "========================================================"
echo "      Launch AI Watermark Remover Studio (GUI)          "
echo "========================================================"
echo "Starting local GUI Studio and opening browser..."

if [ -f ".venv/bin/python3" ]; then
    PYTHONPATH=src .venv/bin/python3 -m remove_ai_watermarks.server --open
elif command -v python3 &> /dev/null; then
    PYTHONPATH=src python3 -m remove_ai_watermarks.server --open
else
    echo "Error: Python 3 not found!"
    read -p "Press Enter to exit..."
fi
