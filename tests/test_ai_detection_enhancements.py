"""Unit tests for Smart AI & Detection Enhancements."""

import unittest
import numpy as np
import cv2
from remove_ai_watermarks.server import compute_fft_heatmap, compute_magic_wand_bbox

class TestAIDetectionEnhancements(unittest.TestCase):

    def test_fft_heatmap_spectrogram(self):
        bgr = np.full((128, 128, 3), 150, dtype=np.uint8)
        # Draw a synthetic high frequency grid
        bgr[::10, :] = 255
        heatmap_url = compute_fft_heatmap(bgr)
        self.assertTrue(heatmap_url.startswith("data:image/png;base64,"))

    def test_magic_wand_bbox_calculator(self):
        bgr = np.full((200, 200, 3), 255, dtype=np.uint8)
        # Draw a distinct dark square logo feature
        cv2.rectangle(bgr, (50, 50), (80, 80), (0, 0, 0), -1)
        bbox = compute_magic_wand_bbox(bgr, 60, 60)
        self.assertIsNotNone(bbox)
        self.assertEqual(len(bbox), 4)
        x, y, w, h = bbox
        self.assertTrue(x <= 60 and y <= 60)
        self.assertTrue(w >= 20 and h >= 20)

if __name__ == "__main__":
    unittest.main()
