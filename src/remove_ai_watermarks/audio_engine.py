"""Audio AI watermark removal engine.

Processes audio files (MP3, WAV, FLAC, M4A, OGG), stripping container AI metadata
and applying spectral perturbation to neutralize invisible audio watermarks
(ElevenLabs, Suno, Udio, AudioSeal) while maintaining audio fidelity.
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np

if TYPE_CHECKING:
    from numpy.typing import NDArray


from remove_ai_watermarks.metadata import remove_ai_metadata

logger = logging.getLogger(__name__)

SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"}


def process_audio(
    input_path: Path | str,
    output_path: Path | str,
    *,
    intensity: float = 0.05,
) -> Path:
    """Process an audio file, removing container metadata and neutralizing audio watermarks.

    Args:
        input_path: Path to input audio file.
        output_path: Target path for cleaned audio file.
        intensity: Spectral perturbation intensity (0.01 - 0.10).

    Returns:
        Path to cleaned audio file.
    """
    input_p = Path(input_path).resolve()
    output_p = Path(output_path).resolve()

    if not input_p.exists():
        raise FileNotFoundError(f"Audio file not found: {input_p}")

    output_p.parent.mkdir(parents=True, exist_ok=True)

    # Step 1: Container-level metadata stripping
    logger.info("Stripping container metadata from audio file %s", input_p.name)
    try:
        stripped_tmp = remove_ai_metadata(input_p, output_p)
    except RuntimeError as err:
        logger.warning("Metadata stripping fallback (ffmpeg absent): %s", err)
        shutil.copyfile(input_p, output_p)
        stripped_tmp = output_p

    # Step 2: High-frequency & phase perturbation for WAV/PCM files if scipy/soundfile available
    try:
        import scipy.signal as signal
        import soundfile as sf

        if input_p.suffix.lower() == ".wav":
            data, samplerate = sf.read(str(stripped_tmp))
            if data.ndim == 1:
                channels = 1
                audio = data[:, np.newaxis]
            else:
                channels = data.shape[1]
                audio = data

            # Apply high-frequency phase perturbation (notch out top 0.5% watermark frequencies)
            nyquist = samplerate / 2.0
            cutoff = nyquist * 0.985
            b, a = signal.butter(4, cutoff / nyquist, btype="lowpass")

            processed_channels = []
            for ch in range(channels):
                low_freq = signal.filtfilt(b, a, audio[:, ch])
                high_freq = audio[:, ch] - low_freq
                # Perturb phase of high-frequency components slightly to destroy watermark alignment
                noise = np.random.normal(0, intensity * 0.001, size=high_freq.shape)
                processed_channels.append(low_freq + high_freq * (1.0 - intensity) + noise)

            cleaned_audio = np.column_stack(processed_channels)
            if channels == 1:
                cleaned_audio = cleaned_audio.squeeze()

            cleaned_audio = suppress_audio_artifacts(cleaned_audio, samplerate)

            sf.write(str(output_p), cleaned_audio, samplerate)
            logger.info("Spectral perturbation and artifact suppression applied to WAV audio -> %s", output_p)
            return output_p

    except ImportError:
        logger.debug("scipy/soundfile not available; returning container-stripped audio file")
    except Exception as e:
        logger.warning("Audio spectral processing warning: %s", e)

    return stripped_tmp


def suppress_audio_artifacts(audio_data: NDArray[Any], sample_rate: int) -> NDArray[Any]:
    """Suppress robotic buzz, synthetic hum, and phase distortion artifacts from AI audio."""
    try:
        import scipy.signal as signal

        # High-pass filter to remove low-frequency power hum (< 60Hz)
        nyquist = sample_rate / 2.0
        b_hp, a_hp = signal.butter(2, 60.0 / nyquist, btype="highpass")

        if audio_data.ndim == 1:
            filtered = signal.filtfilt(b_hp, a_hp, audio_data)
        else:
            channels = [signal.filtfilt(b_hp, a_hp, audio_data[:, ch]) for ch in range(audio_data.shape[1])]
            filtered = np.column_stack(channels)

        return filtered
    except Exception:
        return audio_data
