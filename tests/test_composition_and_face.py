"""Unit tests for AI Face Enhancer, Canvas Composition transforms, and Folder Watcher module."""

import unittest
import numpy as np
from remove_ai_watermarks.server import enhance_face_skin, apply_canvas_transforms
from remove_ai_watermarks import watcher

class TestCompositionAndFace(unittest.TestCase):

    def test_face_skin_enhancer(self):
        bgr = np.full((120, 120, 3), 150, dtype=np.uint8)
        enhanced = enhance_face_skin(bgr)
        self.assertEqual(enhanced.shape, (120, 120, 3))

    def test_canvas_rotation(self):
        # 100x200 image -> rotate 90 deg -> 200x100
        bgr = np.full((100, 200, 3), 100, dtype=np.uint8)
        rotated = apply_canvas_transforms(bgr, 90, False, False)
        self.assertEqual(rotated.shape, (200, 100, 3))

    def test_canvas_flipping(self):
        bgr = np.full((100, 100, 3), 120, dtype=np.uint8)
        bgr[0, 0] = [255, 0, 0]  # Blue pixel at top-left
        flipped = apply_canvas_transforms(bgr, 0, True, False)  # Flip horizontal
        self.assertEqual(flipped.shape, (100, 100, 3))
        self.assertTrue(np.array_equal(flipped[0, 99], [255, 0, 0]))

    def test_watcher_module_constants(self):
        self.assertIn(".png", watcher.SUPPORTED_EXTS)

if __name__ == "__main__":
    unittest.main()
