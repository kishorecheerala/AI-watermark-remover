"""Remove-AI-Watermarks: Unified tool for removing visible and invisible AI watermarks.

High-level API (lazy, so ``import remove_ai_watermarks`` stays cheap)::

    import remove_ai_watermarks as raiw
    raiw.remove_visible("in.png", "out.png")            # clean a file (provenance auto)
    result, removed = raiw.remove_visible(bgr_array)    # array -> array
    raiw.visible_provenance("in.png")                   # -> frozenset of confirmed vendors

For a provenance verdict use the ``identify`` submodule::

    from remove_ai_watermarks.identify import identify
    report = identify("in.png")
"""

import os as _os
import warnings as _warnings
from typing import TYPE_CHECKING

# transformers prints a noisy deprecation for the Siglip2ImageProcessorFast
# alias when it is imported (by the optional GPU/ML path). Silence it before
# any submodule pulls transformers in, so the CLI startup stays quiet. Uses
# setdefault so a user-set TRANSFORMERS_VERBOSITY still wins.
_os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
_warnings.filterwarnings("ignore", message=r".*ImageProcessorFast.*")


__version__ = "0.20.0"

__all__ = [
    "__version__",
    "remove_visible",
    "visible_provenance",
    "process_video",
    "process_audio",
    "humanize_filename",
    "is_ai_filename",
    "humanize_exif",
]

if TYPE_CHECKING:
    from remove_ai_watermarks.api import remove_visible, visible_provenance
    from remove_ai_watermarks.audio_engine import process_audio
    from remove_ai_watermarks.filename_humanizer import humanize_exif, humanize_filename, is_ai_filename
    from remove_ai_watermarks.video_engine import process_video


def __getattr__(name: str) -> object:
    """Lazily resolve the high-level API (PEP 562), so the heavy imports (cv2, the
    metadata/identify stack) load only when a caller actually reaches for them."""
    if name in ("remove_visible", "visible_provenance"):
        from remove_ai_watermarks import api

        return getattr(api, name)
    if name == "process_video":
        from remove_ai_watermarks.video_engine import process_video

        return process_video
    if name == "process_audio":
        from remove_ai_watermarks.audio_engine import process_audio

        return process_audio
    if name in ("humanize_filename", "is_ai_filename", "humanize_exif"):
        from remove_ai_watermarks import filename_humanizer

        return getattr(filename_humanizer, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


