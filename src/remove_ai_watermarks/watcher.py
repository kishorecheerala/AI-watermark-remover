"""Live Folder Watcher Service for AI Watermark Remover Studio.

Monitors an input folder continuously; any newly saved image file is automatically
cleaned of AI watermarks/metadata and exported to the output folder.
"""

from __future__ import annotations

import logging
import sys
import time
from pathlib import Path

from remove_ai_watermarks import api

logger = logging.getLogger("raiw.watcher")

SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".heic"}


def watch_folder(input_dir: str | Path, output_dir: str | Path, poll_interval: float = 2.0) -> None:
    """Continuously monitor input_dir and clean newly added images to output_dir."""
    in_path = Path(input_dir)
    out_path = Path(output_dir)
    in_path.mkdir(parents=True, exist_ok=True)
    out_path.mkdir(parents=True, exist_ok=True)

    processed_files: set[Path] = set()

    try:
        while True:
            for file_path in in_path.iterdir():
                valid = file_path.is_file() and file_path.suffix.lower() in SUPPORTED_EXTS
                if valid and file_path not in processed_files:
                    target_file = out_path / file_path.name
                    try:
                        api.remove_visible(file_path, target_file, strip_metadata=True)
                        processed_files.add(file_path)
                    except Exception as e:
                        logger.error("Failed to clean %s: %s", file_path.name, e)

            time.sleep(poll_interval)
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)
    watch_folder(sys.argv[1], sys.argv[2])
