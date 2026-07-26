"""Filename Humanizer and EXIF Synthesizer module.

Sanitizes AI-suggesting filenames (e.g., ChatGPT_Image_*, Gemini_Generated_*, SDXL_*)
into natural camera roll patterns (Samsung 20260726_083908.jpg, DSLR DSC_4829.jpg)
and optionally synthesizes standard non-AI camera EXIF headers.
"""

from __future__ import annotations

import datetime
import logging
import re
from pathlib import Path
from typing import Literal

logger = logging.getLogger(__name__)

# Patterns matching typical AI generator naming schemes
AI_FILENAME_PATTERNS = [
    re.compile(r"^ChatGPT_Image_.*", re.IGNORECASE),
    re.compile(r"^Gemini_Generated_Image_.*", re.IGNORECASE),
    re.compile(r"^DALL[·\s\-]?E.*", re.IGNORECASE),
    re.compile(r"^SDXL_.*", re.IGNORECASE),
    re.compile(r"^FLUX_.*", re.IGNORECASE),
    re.compile(r"^Kling_.*", re.IGNORECASE),
    re.compile(r"^Jimeng_.*", re.IGNORECASE),
    re.compile(r"^Doubao_.*", re.IGNORECASE),
    re.compile(r"^Midjourney_.*", re.IGNORECASE),
    re.compile(r"^Qwen_.*", re.IGNORECASE),
    re.compile(r"^RunningHub_.*", re.IGNORECASE),
]

Style = Literal["samsung", "dslr", "iphone"]


def is_ai_filename(filename: str) -> bool:
    """Check if a filename matches known AI generator patterns."""
    stem = Path(filename).stem
    return any(pattern.match(stem) for pattern in AI_FILENAME_PATTERNS)


def humanize_filename(
    filepath: Path | str,
    *,
    style: Style = "samsung",
    counter: int = 1001,
) -> Path:
    """Sanitize an AI file path into a natural smartphone or camera filename.

    Args:
        filepath: Source file path.
        style: Target naming style ('samsung', 'dslr', 'iphone').
        counter: Optional index counter for DSLR/iPhone styles.

    Returns:
        Path object with sanitized filename.
    """
    path = Path(filepath)
    ext = path.suffix.lower()
    now = datetime.datetime.now()

    if style == "samsung":
        # Format: YYYYMMDD_HHMMSS.ext (e.g. 20260726_083908.jpg)
        new_name = f"{now.strftime('%Y%m%d_%H%M%S')}{ext}"
    elif style == "dslr":
        # Format: DSC_XXXX.ext (e.g. DSC_4829.jpg)
        num = (counter + abs(hash(path.stem))) % 9000 + 1000
        new_name = f"DSC_{num}{ext}"
    elif style == "iphone":
        # Format: IMG_XXXX.ext (e.g. IMG_8492.jpg)
        num = (counter + abs(hash(path.stem))) % 9000 + 1000
        new_name = f"IMG_{num}{ext}"
    else:
        new_name = f"{now.strftime('%Y%m%d_%H%M%S')}{ext}"

    humanized_path = path.parent / new_name
    logger.info("Humanized filename: %s -> %s", path.name, new_name)
    return humanized_path


def humanize_exif(image_path: Path | str, camera_model: str = "samsung_s24") -> Path:
    """Synthesize non-AI camera EXIF metadata tags onto an image file.

    Args:
        image_path: Target image file path.
        camera_model: Preset camera model ('samsung_s24', 'canon_eos', 'iphone_15').

    Returns:
        Path to updated image file.
    """
    p = Path(image_path)
    if not p.exists() or p.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
        return p

    try:
        import piexif
        from PIL import Image

        img = Image.open(p)

        now_str = datetime.datetime.now().strftime("%Y:%m:%d %H:%M:%S")
        zeroth_ifd = {
            piexif.ImageIFD.Make: b"Samsung" if "samsung" in camera_model else b"Canon",
            piexif.ImageIFD.Model: b"Galaxy S24 Ultra" if "samsung" in camera_model else b"EOS R6",
            piexif.ImageIFD.Software: b"One UI 6.1" if "samsung" in camera_model else b"v1.8.0",
            piexif.ImageIFD.DateTime: now_str.encode("utf-8"),
        }

        exif_ifd = {
            piexif.ExifIFD.DateTimeOriginal: now_str.encode("utf-8"),
            piexif.ExifIFD.DateTimeDigitized: now_str.encode("utf-8"),
            piexif.ExifIFD.ISOSpeedRatings: 50,
            piexif.ExifIFD.FNumber: (17, 10),
            piexif.ExifIFD.ExposureTime: (1, 120),
            piexif.ExifIFD.FocalLength: (63, 10),
        }

        exif_bytes = piexif.dump({"0th": zeroth_ifd, "Exif": exif_ifd})

        if p.suffix.lower() in {".jpg", ".jpeg"}:
            piexif.insert(exif_bytes, str(p))
            logger.info("Injected camera EXIF tags onto %s", p.name)
    except Exception as e:
        logger.debug("EXIF humanization skipped: %s", e)

    return p
