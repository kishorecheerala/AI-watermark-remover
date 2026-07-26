"""Unit tests for AI Watermark Remover Studio enhanced features."""

import unittest

import cv2
import numpy as np

from remove_ai_watermarks import region_eraser


class TestEnhancedStudioFeatures(unittest.TestCase):
    def test_watermark_text_stamper(self):
        bgr = np.full((300, 300, 3), 200, dtype=np.uint8)
        text = "© Kishore Cheerala"
        font = cv2.FONT_HERSHEY_SIMPLEX
        scale = 0.5
        thickness = 1
        (tw, _th), _ = cv2.getTextSize(text, font, scale, thickness)
        tx = 300 - tw - 20
        ty = 300 - 20
        cv2.putText(bgr, text, (tx, ty), font, scale, (255, 255, 255), thickness, cv2.LINE_AA)

        assert bgr.shape == (300, 300, 3)
        assert np.any(bgr != 200)  # Verify text pixels were rendered

    def test_custom_region_eraser_bounds(self):
        bgr = np.full((200, 200, 3), 100, dtype=np.uint8)
        # Draw a synthetic dark box to erase
        bgr[50:80, 50:80] = 0
        cleaned = region_eraser.erase(bgr, boxes=[(50, 50, 30, 30)], backend="cv2")
        assert cleaned.shape == (200, 200, 3)


if __name__ == "__main__":
    unittest.main()
