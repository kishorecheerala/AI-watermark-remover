"""Tests for video_engine and audio_engine modules."""

from __future__ import annotations

import tempfile
from pathlib import Path

import cv2
import numpy as np

from remove_ai_watermarks.audio_engine import process_audio
from remove_ai_watermarks.video_engine import process_video


def test_video_engine_processing():
    """Test frame processing and video generation with process_video."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        input_video = tmp_path / "sample_video.avi"
        output_video = tmp_path / "cleaned_video.avi"

        # Create a synthetic 10-frame video
        fourcc = cv2.VideoWriter_fourcc(*"MJPG")
        writer = cv2.VideoWriter(str(input_video), fourcc, 10.0, (100, 100))
        for _ in range(10):
            frame = np.full((100, 100, 3), 128, dtype=np.uint8)
            # Add synthetic watermark box
            frame[80:95, 80:95] = 255
            writer.write(frame)
        writer.release()

        cv2.destroyAllWindows()

        # Run process_video with region erasure
        res = process_video(
            input_path=input_video,
            output_path=output_video,
            region=(80, 80, 15, 15),
            backend="cv2",
        )

        assert res.exists()
        assert res.stat().st_size > 0

        # Read back video to verify frames processed
        cap = cv2.VideoCapture(str(res))
        assert cap.isOpened()
        ret, read_frame = cap.read()
        assert ret
        assert read_frame.shape == (100, 100, 3)
        cap.release()


def test_audio_engine_processing():
    """Test audio container stripping and processing with process_audio."""
    import wave

    with tempfile.TemporaryDirectory() as tmp_dir:
        tmp_path = Path(tmp_dir)
        input_audio = tmp_path / "sample_audio.wav"
        output_audio = tmp_path / "cleaned_audio.wav"

        # Generate 1 second mono 16-bit PCM WAV file using standard wave library
        sample_rate = 16000
        n_samples = sample_rate * 1
        noise = (np.random.uniform(-1, 1, n_samples) * 32767).astype(np.int16)

        with wave.open(str(input_audio), "w") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.writeframes(noise.tobytes())

        res = process_audio(
            input_path=input_audio,
            output_path=output_audio,
            intensity=0.05,
        )

        assert res.exists()
        assert res.stat().st_size > 0
