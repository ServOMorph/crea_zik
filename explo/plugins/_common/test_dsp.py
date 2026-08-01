from __future__ import annotations

import math
import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from _common import dsp  # noqa: E402

MANIFEST = {
    "parameter_groups": [
        {
            "id": "groupe",
            "label": "Groupe",
            "parameters": [
                {"id": "gain", "type": "float", "min": 0.0, "max": 2.0, "default": 1.0},
                {"id": "mode", "type": "enum", "values": ["a", "b"], "default": "a"},
                {"id": "actif", "type": "bool", "default": True},
                {"id": "compte", "type": "int", "min": 0, "max": 10, "default": 4},
            ],
        }
    ]
}


class ParameterDefsTests(unittest.TestCase):
    def test_parameter_defs_flattens_groups(self) -> None:
        defs = dsp.parameter_defs(MANIFEST)
        self.assertEqual(set(defs), {"gain", "mode", "actif", "compte"})

    def test_default_params_uses_manifest_defaults(self) -> None:
        defs = dsp.parameter_defs(MANIFEST)
        defaults = dsp.default_params(defs)
        self.assertEqual(defaults, {"gain": 1.0, "mode": "a", "actif": True, "compte": 4})


class ValidateParamsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.defs = dsp.parameter_defs(MANIFEST)
        self.params = dsp.default_params(self.defs)

    def test_valid_params_pass(self) -> None:
        dsp.validate_params(self.defs, self.params)

    def test_missing_parameter_is_rejected(self) -> None:
        params = dict(self.params)
        del params["gain"]
        with self.assertRaises(ValueError):
            dsp.validate_params(self.defs, params)

    def test_unknown_parameter_is_rejected(self) -> None:
        params = dict(self.params, extra=1)
        with self.assertRaises(ValueError):
            dsp.validate_params(self.defs, params)

    def test_out_of_bounds_is_rejected(self) -> None:
        params = dict(self.params, gain=3.0)
        with self.assertRaises(ValueError):
            dsp.validate_params(self.defs, params)

    def test_wrong_enum_value_is_rejected(self) -> None:
        params = dict(self.params, mode="c")
        with self.assertRaises(ValueError):
            dsp.validate_params(self.defs, params)

    def test_non_bool_for_bool_parameter_is_rejected(self) -> None:
        params = dict(self.params, actif=1)
        with self.assertRaises(ValueError):
            dsp.validate_params(self.defs, params)

    def test_non_integer_for_int_parameter_is_rejected(self) -> None:
        params = dict(self.params, compte=2.5)
        with self.assertRaises(ValueError):
            dsp.validate_params(self.defs, params)


class ValidateVelocityTests(unittest.TestCase):
    def test_in_range_passes(self) -> None:
        dsp.validate_velocity(0.0)
        dsp.validate_velocity(1.0)
        dsp.validate_velocity(0.5)

    def test_out_of_range_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            dsp.validate_velocity(1.5)
        with self.assertRaises(ValueError):
            dsp.validate_velocity(-0.1)


class DriveTests(unittest.TestCase):
    def test_zero_amount_is_passthrough(self) -> None:
        buffer = np.array([0.1, -0.5, 0.9])
        np.testing.assert_array_equal(dsp.drive(buffer, 0.0), buffer)

    def test_positive_amount_saturates_peak_towards_one(self) -> None:
        buffer = np.array([1.0, -1.0])
        driven = dsp.drive(buffer, 1.0)
        self.assertTrue(np.all(np.abs(driven) <= 1.0 + 1e-9))
        self.assertTrue(np.all(np.isfinite(driven)))


class HighpassTests(unittest.TestCase):
    def test_attenuates_low_frequency_relative_to_high(self) -> None:
        sample_rate = 48000
        time = np.arange(sample_rate) / sample_rate
        low = np.sin(2 * np.pi * 20 * time)
        high = np.sin(2 * np.pi * 5000 * time)
        filtered_low = dsp.highpass(low, 1000.0, sample_rate)
        filtered_high = dsp.highpass(high, 1000.0, sample_rate)
        self.assertLess(np.max(np.abs(filtered_low[1000:])), 0.1 * np.max(np.abs(low)))
        self.assertGreater(np.max(np.abs(filtered_high[1000:])), 0.5 * np.max(np.abs(high)))


class BandpassTests(unittest.TestCase):
    def test_passes_center_and_attenuates_far_frequencies(self) -> None:
        sample_rate = 48000
        time = np.arange(sample_rate) / sample_rate
        low = np.sin(2 * np.pi * 50 * time)
        center = np.sin(2 * np.pi * 1500 * time)
        high = np.sin(2 * np.pi * 15000 * time)
        filtered_low = dsp.bandpass(low, 1500.0, 800.0, sample_rate)
        filtered_center = dsp.bandpass(center, 1500.0, 800.0, sample_rate)
        filtered_high = dsp.bandpass(high, 1500.0, 800.0, sample_rate)
        self.assertLess(np.max(np.abs(filtered_low[1000:])), 0.1 * np.max(np.abs(low)))
        self.assertLess(np.max(np.abs(filtered_high[1000:])), 0.1 * np.max(np.abs(high)))
        self.assertGreater(np.max(np.abs(filtered_center[1000:])), 0.5 * np.max(np.abs(center)))


class StereoTests(unittest.TestCase):
    def test_pan_left_is_silent_on_right(self) -> None:
        mono = np.array([1.0, 1.0])
        result = dsp.stereo(mono, -1.0)
        np.testing.assert_allclose(result[:, 1], 0.0, atol=1e-9)

    def test_pan_right_is_silent_on_left(self) -> None:
        mono = np.array([1.0, 1.0])
        result = dsp.stereo(mono, 1.0)
        np.testing.assert_allclose(result[:, 0], 0.0, atol=1e-9)

    def test_pan_center_is_equal_power(self) -> None:
        mono = np.array([1.0, 1.0])
        result = dsp.stereo(mono, 0.0)
        np.testing.assert_allclose(result[:, 0], result[:, 1])


class FinalizeOutputTests(unittest.TestCase):
    def test_normalizes_to_target_peak(self) -> None:
        params = {
            "drive_amount": 0.0,
            "output_gain": 1.0,
            "target_peak_dbfs": -6.0,
            "pan": 0.0,
        }
        mix = np.array([0.1, -0.4, 0.2])
        result = dsp.finalize_output(mix, params, velocity=1.0)
        expected_peak = 10.0 ** (-6.0 / 20.0) * math.cos(math.pi / 4.0)
        self.assertAlmostEqual(float(np.max(np.abs(result))), expected_peak, places=6)

    def test_silence_stays_silent(self) -> None:
        params = {
            "drive_amount": 0.0,
            "output_gain": 1.0,
            "target_peak_dbfs": -1.0,
            "pan": 0.0,
        }
        mix = np.zeros(10)
        result = dsp.finalize_output(mix, params, velocity=1.0)
        self.assertTrue(np.all(result == 0.0))


if __name__ == "__main__":
    unittest.main()
