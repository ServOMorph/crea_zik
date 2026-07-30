from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
from scipy import signal


ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))


def parameter_defs() -> dict[str, dict[str, Any]]:
    defs: dict[str, dict[str, Any]] = {}
    for group in MANIFEST["parameter_groups"]:
        for parameter in group["parameters"]:
            defs[parameter["id"]] = parameter
    return defs


PARAMETER_DEFS = parameter_defs()


def default_params() -> dict[str, Any]:
    return {parameter_id: definition["default"] for parameter_id, definition in PARAMETER_DEFS.items()}


def validate_params(params: dict[str, Any]) -> None:
    missing = PARAMETER_DEFS.keys() - params.keys()
    if missing:
        raise ValueError(f"Paramètres manquants: {', '.join(sorted(missing))}")
    unknown = params.keys() - PARAMETER_DEFS.keys()
    if unknown:
        raise ValueError(f"Paramètres inconnus: {', '.join(sorted(unknown))}")
    for parameter_id, value in params.items():
        definition = PARAMETER_DEFS[parameter_id]
        kind = definition["type"]
        if kind == "bool":
            if not isinstance(value, bool):
                raise ValueError(f"{parameter_id} doit être un booléen")
        elif kind == "enum":
            if value not in definition["values"]:
                raise ValueError(f"{parameter_id} doit être parmi {definition['values']}")
        elif kind in ("float", "int"):
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise ValueError(f"{parameter_id} doit être numérique")
            if kind == "int" and not float(value).is_integer():
                raise ValueError(f"{parameter_id} doit être un entier")
            if not (definition["min"] <= value <= definition["max"]):
                raise ValueError(f"{parameter_id} hors bornes [{definition['min']}, {definition['max']}]")


def midi_to_hz(note: float) -> float:
    return 440.0 * 2.0 ** ((note - 69.0) / 12.0)


def drive(buffer: np.ndarray, amount: float) -> np.ndarray:
    if amount <= 0.0:
        return buffer
    factor = 1.0 + amount * 9.0
    return np.tanh(buffer * factor) / math.tanh(factor)


def highpass(buffer: np.ndarray, cutoff_hz: float, sample_rate: int) -> np.ndarray:
    cutoff = min(max(cutoff_hz, 1.0), sample_rate / 2.0 * 0.99)
    sos = signal.butter(2, cutoff, btype="highpass", fs=sample_rate, output="sos")
    return signal.sosfilt(sos, buffer)


def stereo(mono: np.ndarray, pan: float) -> np.ndarray:
    angle = (np.clip(pan, -1.0, 1.0) + 1.0) * math.pi / 4.0
    return np.column_stack((mono * math.cos(angle), mono * math.sin(angle)))


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


def body_layer(time: np.ndarray, sample_rate: int, params: dict[str, Any]) -> np.ndarray:
    frequency = pitch_envelope(time, params)
    phase = params["phase_start"] + 2.0 * math.pi * np.cumsum(frequency) / sample_rate
    if params["body_waveform"] == "sine":
        wave = np.sin(phase)
    else:
        wave = signal.sawtooth(phase, width=0.5)
    envelope = decay_envelope(time, params["body_decay"], params["body_curve"])
    return wave * envelope


def sub_layer(time: np.ndarray, params: dict[str, Any]) -> np.ndarray:
    if not params["sub_enabled"]:
        return np.zeros_like(time)
    frequency = midi_to_hz(params["sub_freq"])
    wave = np.sin(2.0 * math.pi * frequency * time)
    envelope = np.exp(-time / params["sub_decay"])
    return drive(wave * envelope, params["sub_drive"]) * params["sub_gain"]


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
    filtered = highpass(raw, params["click_highpass"], sample_rate)
    envelope = np.exp(-time / params["click_decay"])
    return filtered * envelope * params["click_gain"]


def noise_layer(time: np.ndarray, sample_rate: int, rng: np.random.Generator, params: dict[str, Any]) -> np.ndarray:
    raw = rng.standard_normal(len(time))
    filtered = highpass(raw, params["noise_filter"], sample_rate)
    envelope = np.exp(-time / params["noise_decay"])
    return filtered * envelope * params["noise_gain"]


def render(params: dict[str, Any], velocity: float, sample_rate: int) -> np.ndarray:
    validate_params(params)
    if not (0.0 <= velocity <= 1.0):
        raise ValueError("velocity doit être dans [0, 1]")
    count = max(1, int(round(params["length"] * sample_rate)))
    time = np.arange(count) / sample_rate
    rng = np.random.default_rng(params["seed"])

    mix = (
        body_layer(time, sample_rate, params)
        + sub_layer(time, params)
        + click_layer(time, sample_rate, rng, params)
        + noise_layer(time, sample_rate, rng, params)
    )
    mix = drive(mix, params["drive_amount"])
    mix = mix * params["output_gain"] * velocity

    peak = float(np.max(np.abs(mix)))
    if peak > 0.0:
        target_peak = 10.0 ** (params["target_peak_dbfs"] / 20.0)
        mix = mix * (target_peak / peak)

    if not np.isfinite(mix).all():
        raise ValueError("Rendu non fini")

    return stereo(mix, params["pan"])
