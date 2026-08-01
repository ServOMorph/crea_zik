from __future__ import annotations

import copy
import hashlib
import sys
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from render import load_spec, one_shot_plugin_voice, render_audio


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

    def test_drums_use_the_kick_plugin_preset(self) -> None:
        spec = load_spec(Path(__file__).with_name("spec.json"))
        short = copy.deepcopy(spec)
        short["duration_seconds"] = 5.0
        _, stems = render_audio(short)

        drum_plan = short["render_plan"]["drums"]
        kick_plan = drum_plan["kick"]
        kick_config = short["tracks"][0]["instrument"]["kick"]
        expected = one_shot_plugin_voice(
            kick_config,
            kick_plan["duration"],
            kick_plan["amplitude_before"],
            kick_plan["pan"],
            short["sample_rate"],
        ) * short["tracks"][0]["gain"]
        start = int(8 * 60.0 / short["tempo_bpm"] * short["sample_rate"])

        np.testing.assert_array_equal(stems["drums"][start : start + len(expected)], expected)


if __name__ == "__main__":
    unittest.main()
