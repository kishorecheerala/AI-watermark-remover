"""Integration and robustness tests for remove-ai-watermarks offline API and progress reporting."""

import unittest

import numpy as np
import pytest

from remove_ai_watermarks import api


class TestOfflinePipeline(unittest.TestCase):
    def test_api_remove_visible_noop(self):
        # Synthetic solid BGR image
        bgr = np.full((100, 100, 3), 128, dtype=np.uint8)
        res, removed = api.remove_visible(bgr, sensitivity="strict")
        assert len(removed) == 0
        assert res.shape == (100, 100, 3)

    def test_sensitivity_validation(self):
        bgr = np.full((50, 50, 3), 200, dtype=np.uint8)
        with pytest.raises(ValueError, match="sensitivity"):
            api.remove_visible(bgr, sensitivity="invalid_choice")


if __name__ == "__main__":
    unittest.main()
