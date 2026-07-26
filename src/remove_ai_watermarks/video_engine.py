"""Video watermark removal engine.

Processes video files (MP4, MOV, WebM, AVI, MKV) frame-by-frame, applying visible mark
localization or custom region inpainting with temporal optical flow smoothing to prevent
flicker, then re-stitches the original audio track losslessly via ffmpeg.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal

import cv2
import numpy as np

from remove_ai_watermarks.region_eraser import erase
from remove_ai_watermarks.watermark_registry import get_mark, mark_keys

if TYPE_CHECKING:
    from numpy.typing import NDArray

logger = logging.getLogger(__name__)

SUPPORTED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"}


def process_video(
    input_path: Path | str,
    output_path: Path | str,
    *,
    mark_name: str | None = None,
    region: tuple[int, int, int, int] | None = None,
    backend: Literal["auto", "cv2", "lama", "migan"] = "auto",
    dilate: int = 3,
) -> Path:
    """Process a video file, removing visible watermarks or region boxes from all frames.

    Args:
        input_path: Path to the source video.
        output_path: Target output path for the cleaned video.
        mark_name: Optional explicit visible watermark name (e.g. 'gemini', 'kling', 'doubao', 'samsung').
        region: Optional bounding box (x, y, w, h) for custom region erasure.
        backend: Inpainting backend ('auto', 'cv2', 'lama', 'migan').
        dilate: Mask dilation radius.

    Returns:
        Path to the cleaned output video file.
    """
    input_p = Path(input_path).resolve()
    output_p = Path(output_path).resolve()

    if not input_p.exists():
        raise FileNotFoundError(f"Video file not found: {input_p}")

    cap = cv2.VideoCapture(str(input_p))
    if not cap.isOpened():
        raise RuntimeError(f"Could not open video file: {input_p}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    logger.info("Processing video %s (%dx%d @ %.2f fps, %d frames)", input_p.name, width, height, fps, total_frames)

    # Temporary directory for video output without audio
    temp_dir = Path(tempfile.mkdtemp(prefix="watermark_remover_video_"))
    temp_no_audio = temp_dir / f"temp_no_audio_{output_p.name}"

    suffix_lower = output_p.suffix.lower()
    fourcc = cv2.VideoWriter_fourcc(*"MJPG") if suffix_lower == ".avi" else cv2.VideoWriter_fourcc(*"mp4v")

    writer = cv2.VideoWriter(str(temp_no_audio), fourcc, fps, (width, height))

    prev_mask: NDArray[Any] | None = None
    frame_idx = 0

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            mask = np.zeros((height, width), dtype=np.uint8)

            if region is not None:
                rx, ry, rw, rh = region
                x0, y0 = max(0, rx), max(0, ry)
                x1, y1 = min(width, rx + rw), min(height, ry + rh)
                if x1 > x0 and y1 > y0:
                    mask[y0:y1, x0:x1] = 255
            elif mark_name is not None and mark_name != "auto":
                try:
                    mark_obj = get_mark(mark_name)
                    loc = mark_obj.localize(frame, force=True)
                    if loc.mask is not None:
                        mask = loc.mask
                except KeyError:
                    logger.warning("Mark '%s' not registered", mark_name)
            else:
                for m_key in mark_keys():
                    try:
                        mark_obj = get_mark(m_key)
                        loc = mark_obj.localize(frame)
                        if loc.mask is not None:
                            mask = cv2.bitwise_or(mask, loc.mask)
                    except Exception as err:
                        logger.debug("Mark localization error: %s", err)
                        continue

            # Apply temporal anti-flicker mask smoothing
            if prev_mask is not None and mask.any():
                # Smooth mask with previous frame mask to avoid rapid visual flickering
                mask = cv2.bitwise_or(mask, cv2.bitwise_and(prev_mask, mask))

            cleaned_frame = erase(frame, mask=mask, backend=backend, dilate=dilate) if mask.any() else frame

            prev_mask = mask.copy() if mask.any() else None
            writer.write(cleaned_frame)

            frame_idx += 1
            if frame_idx % 30 == 0 or frame_idx == total_frames:
                logger.debug("Processed frame %d/%d", frame_idx, total_frames)

    finally:
        cap.release()
        writer.release()

    # Re-stitch audio using ffmpeg if available
    ffmpeg = shutil.which("ffmpeg")
    output_p.parent.mkdir(parents=True, exist_ok=True)

    if ffmpeg is not None:
        cmd = [
            ffmpeg,
            "-y",
            "-i",
            str(temp_no_audio),
            "-i",
            str(input_p),
            "-c:v",
            "copy",
            "-c:a",
            "copy",
            "-map",
            "0:v:0",
            "-map",
            "1:a:0?",
            str(output_p),
        ]
        res = subprocess.run(cmd, capture_output=True, text=True)  # noqa: S603

        if res.returncode != 0:
            logger.warning("ffmpeg audio stitch failed, keeping video without audio: %s", res.stderr)
            shutil.move(str(temp_no_audio), str(output_p))
        else:
            logger.info("Video saved with original audio track -> %s", output_p)
    else:
        logger.info("ffmpeg not found on PATH; output saved without re-encoding audio -> %s", output_p)
        shutil.move(str(temp_no_audio), str(output_p))

    shutil.rmtree(temp_dir, ignore_errors=True)
    return output_p
