from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from typing import Any

import numpy as np
from scipy import signal

ROOT = Path(__file__).resolve().parent
PLUGINS_ROOT = ROOT.parent
if str(PLUGINS_ROOT) not in sys.path:
    sys.path.insert(0, str(PLUGINS_ROOT))

from _common import dsp  # noqa: E402

MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
PARAMETER_DEFS = dsp.parameter_defs(MANIFEST)


def default_params() -> dict[str, Any]:
    return dsp.default_params(PARAMETER_DEFS)


def validate_params(params: dict[str, Any]) -> None:
    dsp.validate_params(PARAMETER_DEFS, params)


def midi_to_hz(note: float) -> float:
    return 440.0 * 2.0 ** ((note - 69.0) / 12.0)


def pitch_envelope(time: np.ndarray, params: dict[str, Any]) -> np.ndarray:
    start = params["pitch_start"]
    end = params["pitch_end"]
    decay = params["pitch_decay"]
    if params["pitch_curve"] == "exponential":
        return end + (start - end) * np.exp(-time / decay)
    ramp = np.clip(time / decay, 0.0, 1.0)
    return start + (end - start) * ramp


def decay_envelope(time: np.ndarray, decay: float, curve: str) -> np.ndarray:
    if curve == "exponential":
        return np.exp(-time / decay)
    return np.clip(1.0 - time / decay, 0.0, None)


def swept_phase(frequency: np.ndarray, sample_rate: int, phase_start: float = 0.0) -> np.ndarray:
    return phase_start + 2.0 * math.pi * np.cumsum(frequency) / sample_rate


def body_layer(time: np.ndarray, sample_rate: int, params: dict[str, Any]) -> np.ndarray:
    frequency = pitch_envelope(time, params)
    phase = swept_phase(frequency, sample_rate, params["phase_start"])
    if params["body_waveform"] == "sine":
        wave = np.sin(phase)
    else:
        wave = signal.sawtooth(phase, width=0.5)
    envelope = decay_envelope(time, params["body_decay"], params["body_curve"])
    return wave * envelope


def sub_layer(time: np.ndarray, sample_rate: int, params: dict[str, Any]) -> np.ndarray:
    if not params["sub_enabled"]:
        return np.zeros_like(time)
    base_frequency = midi_to_hz(params["sub_freq"])
    start_frequency = base_frequency * 2.0 ** (params["sub_pitch_start_semitones"] / 12.0)
    frequency = base_frequency + (start_frequency - base_frequency) * np.exp(-time / params["sub_pitch_decay"])
    phase = swept_phase(frequency, sample_rate)
    wave = np.sin(phase)
    envelope = np.exp(-time / params["sub_decay"])
    return dsp.drive(wave * envelope, params["sub_drive"]) * params["sub_gain"]


def click_layer(time: np.ndarray, sample_rate: int, rng: np.random.Generator, params: dict[str, Any]) -> np.ndarray:
    count = len(time)
    click_type = params["click_type"]
    if click_type == "noise":
        raw = rng.standard_normal(count)
    elif click_type == "sine":
        raw = np.sin(2.0 * math.pi * params["click_frequency"] * time)
    else:
        raw = np.zeros(count)
        if count:
            raw[0] = 1.0
    filtered = dsp.bandpass(raw, params["click_frequency"], params["click_bandwidth"], sample_rate)
    envelope = np.exp(-time / params["click_decay"])
    return filtered * envelope * params["click_gain"]


def noise_layer(time: np.ndarray, sample_rate: int, rng: np.random.Generator, params: dict[str, Any]) -> np.ndarray:
    raw = rng.standard_normal(len(time))
    filtered = dsp.highpass(raw, params["noise_filter"], sample_rate)
    envelope = np.exp(-time / params["noise_decay"])
    return filtered * envelope * params["noise_gain"]


def render(params: dict[str, Any], velocity: float, sample_rate: int) -> np.ndarray:
    validate_params(params)
    dsp.validate_velocity(velocity)
    count = max(1, int(round(params["length"] * sample_rate)))
    time = np.arange(count) / sample_rate
    rng = np.random.default_rng(params["seed"])

    mix = (
        body_layer(time, sample_rate, params)
        + sub_layer(time, sample_rate, params)
        + click_layer(time, sample_rate, rng, params)
        + noise_layer(time, sample_rate, rng, params)
    )
    return dsp.finalize_output(mix, params, velocity)
