from __future__ import annotations

import copy
import hashlib
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from render import load_spec, render_audio


class RenderTests(unittest.TestCase):
    def test_spec_produces_a_finite_stereo_render_with_exact_duration(self) -> None:
        spec = load_spec(Path(__file__).with_name("spec.json"))
        audio, stems = render_audio(spec)
        self.assertEqual(audio.shape, (1_440_000, 2))
        self.assertTrue(audio.dtype.kind == "f")
        self.assertTrue(np.isfinite(audio).all())
        self.assertEqual(set(stems), {"drums", "bass", "pad", "arp", "lead"})
        self.assertLess(float(abs(audio).max()), 1.0)

    def test_short_render_is_deterministic(self) -> None:
        spec = load_spec(Path(__file__).with_name("spec.json"))
        short = copy.deepcopy(spec)
        short["duration_seconds"] = 4.0
        first, _ = render_audio(short)
        second, _ = render_audio(short)
        self.assertEqual(hashlib.sha256(first.tobytes()).digest(), hashlib.sha256(second.tobytes()).digest())


if __name__ == "__main__":
    unittest.main()
