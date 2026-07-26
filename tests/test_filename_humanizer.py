"""Tests for filename_humanizer module."""

from __future__ import annotations

import tempfile
from pathlib import Path

from remove_ai_watermarks.filename_humanizer import (
    humanize_exif,
    humanize_filename,
    is_ai_filename,
)


def test_is_ai_filename():
    """Verify AI pattern recognition for filenames."""
    assert is_ai_filename("ChatGPT_Image_May_30_2026_10_31_08_AM.png")
    assert is_ai_filename("Gemini_Generated_Image_633uuy633uuy633u.png")
    assert is_ai_filename("DALL-E 2026-07-26.png")
    assert is_ai_filename("SDXL_00001_.png")
    assert is_ai_filename("Kling_3.0_video.mp4")
    assert is_ai_filename("Jimeng_video.mp4")

    # Regular non-AI filenames
    assert not is_ai_filename("20260726_083908.jpg")
    assert not is_ai_filename("DSC_4829.jpg")
    assert not is_ai_filename("IMG_8492.png")


def test_humanize_filename():
    """Verify humanize_filename formatting styles."""
    path = Path("/tmp/ChatGPT_Image_May_30_2026.png")

    samsung_path = humanize_filename(path, style="samsung")
    assert samsung_path.suffix == ".png"
    assert len(samsung_path.stem) == 15  # YYYYMMDD_HHMMSS

    dslr_path = humanize_filename(path, style="dslr")
    assert dslr_path.name.startswith("DSC_")
    assert dslr_path.suffix == ".png"

    iphone_path = humanize_filename(path, style="iphone")
    assert iphone_path.name.startswith("IMG_")
    assert iphone_path.suffix == ".png"


def test_humanize_exif():
    """Verify humanize_exif fallback handling on non-image paths."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_file = Path(tmp_dir) / "test.jpg"
        tmp_file.write_bytes(b"non-image dummy bytes")

        res = humanize_exif(tmp_file, camera_model="samsung_s24")
        assert res.exists()
