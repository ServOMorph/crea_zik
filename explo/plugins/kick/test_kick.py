from __future__ import annotations

import hashlib
import json
import sys
import unittest
from pathlib import Path

import numpy as np
from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from engine import MANIFEST, PARAMETER_DEFS, render, validate_params  # noqa: E402

SCHEMA = json.loads((ROOT.parent / "schema" / "plugin_manifest.schema.json").read_text(encoding="utf-8"))
PRESETS = json.loads((ROOT / "presets.json").read_text(encoding="utf-8"))
REFERENCES = json.loads((ROOT / "references" / "references.json").read_text(encoding="utf-8"))


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class ManifestTests(unittest.TestCase):
    def test_manifest_validates_against_generic_schema(self) -> None:
        Draft202012Validator(SCHEMA).validate(MANIFEST)

    def test_presets_declared_in_manifest_have_definitions(self) -> None:
        self.assertEqual(set(MANIFEST["presets"]), set(PRESETS))


class PresetBoundsTests(unittest.TestCase):
    def test_each_preset_is_within_manifest_bounds(self) -> None:
        for name, params in PRESETS.items():
            with self.subTest(preset=name):
                validate_params(params)

    def test_missing_parameter_is_rejected(self) -> None:
        params = dict(PRESETS["techno"])
        del params["pitch_start"]
        with self.assertRaises(ValueError):
            validate_params(params)

    def test_out_of_bounds_parameter_is_rejected(self) -> None:
        params = dict(PRESETS["techno"])
        params["pitch_start"] = PARAMETER_DEFS["pitch_start"]["max"] + 1.0
        with self.assertRaises(ValueError):
            validate_params(params)

    def test_wrong_enum_value_is_rejected(self) -> None:
        params = dict(PRESETS["techno"])
        params["click_type"] = "invalid"
        with self.assertRaises(ValueError):
            validate_params(params)


class RenderTests(unittest.TestCase):
    def test_render_is_deterministic(self) -> None:
        params = PRESETS["techno"]
        first = render(params, 1.0, 48000)
        second = render(params, 1.0, 48000)
        np.testing.assert_array_equal(first, second)

    def test_render_is_finite_and_does_not_clip(self) -> None:
        for name, params in PRESETS.items():
            with self.subTest(preset=name):
                audio = render(params, 1.0, 48000)
                self.assertTrue(np.isfinite(audio).all())
                self.assertLessEqual(float(np.max(np.abs(audio))), 1.0)

    def test_render_shape_is_stereo(self) -> None:
        audio = render(PRESETS["techno"], 1.0, 48000)
        self.assertEqual(audio.ndim, 2)
        self.assertEqual(audio.shape[1], 2)

    def test_velocity_out_of_range_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            render(PRESETS["techno"], 1.5, 48000)


class NonRegressionTests(unittest.TestCase):
    def test_presets_match_reference_wav(self) -> None:
        for name, params in PRESETS.items():
            with self.subTest(preset=name):
                reference = REFERENCES[name]
                audio = render(params, reference["velocity"], reference["sample_rate"])
                wav_path = ROOT / "references" / f"{name}.wav"
                self.assertEqual(sha256_bytes(wav_path.read_bytes()), reference["sha256"])
                self.assertTrue(np.isfinite(audio).all())


if __name__ == "__main__":
    unittest.main()
