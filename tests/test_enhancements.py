"""Unit tests for Photo Enhancement and Aspect Ratio Auto-Expand features."""

import unittest

import numpy as np

from remove_ai_watermarks.server import apply_aspect_ratio_fit, apply_denoise, enhance_auto_color


class TestPhotoEnhancements(unittest.TestCase):
    def test_auto_color_enhancement(self):
        bgr = np.full((100, 100, 3), 150, dtype=np.uint8)
        enhanced = enhance_auto_color(bgr)
        assert enhanced.shape == (100, 100, 3)

    def test_denoise_filter(self):
        bgr = np.full((100, 100, 3), 120, dtype=np.uint8)
        denoised = apply_denoise(bgr)
        assert denoised.shape == (100, 100, 3)

    def test_aspect_ratio_fit_blur_pad(self):
        # 200x100 (2:1 aspect ratio) -> fit to 1:1 square
        bgr = np.full((100, 200, 3), 180, dtype=np.uint8)
        fitted = apply_aspect_ratio_fit(bgr, "1:1", "blur_pad")
        assert fitted.shape == (200, 200, 3)

    def test_aspect_ratio_fit_9_16(self):
        # 100x100 square -> fit to 9:16 vertical
        bgr = np.full((100, 100, 3), 200, dtype=np.uint8)
        fitted = apply_aspect_ratio_fit(bgr, "9:16", "color_pad")
        assert fitted.shape == (177, 100, 3)


if __name__ == "__main__":
    unittest.main()
