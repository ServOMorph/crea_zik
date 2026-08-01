from __future__ import annotations

import math
from typing import Any

import numpy as np
from scipy import signal


def parameter_defs(manifest: dict[str, Any]) -> dict[str, dict[str, Any]]:
    defs: dict[str, dict[str, Any]] = {}
    for group in manifest["parameter_groups"]:
        for parameter in group["parameters"]:
            defs[parameter["id"]] = parameter
    return defs


def default_params(parameter_definitions: dict[str, dict[str, Any]]) -> dict[str, Any]:
    return {parameter_id: definition["default"] for parameter_id, definition in parameter_definitions.items()}


def validate_params(parameter_definitions: dict[str, dict[str, Any]], params: dict[str, Any]) -> None:
    missing = parameter_definitions.keys() - params.keys()
    if missing:
        raise ValueError(f"Paramètres manquants: {', '.join(sorted(missing))}")
    unknown = params.keys() - parameter_definitions.keys()
    if unknown:
        raise ValueError(f"Paramètres inconnus: {', '.join(sorted(unknown))}")
    for parameter_id, value in params.items():
        definition = parameter_definitions[parameter_id]
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


def validate_velocity(velocity: float) -> None:
    if not (0.0 <= velocity <= 1.0):
        raise ValueError("velocity doit être dans [0, 1]")


def drive(buffer: np.ndarray, amount: float) -> np.ndarray:
    if amount <= 0.0:
        return buffer
    factor = 1.0 + amount * 9.0
    return np.tanh(buffer * factor) / math.tanh(factor)


def highpass(buffer: np.ndarray, cutoff_hz: float, sample_rate: int) -> np.ndarray:
    cutoff = min(max(cutoff_hz, 1.0), sample_rate / 2.0 * 0.99)
    sos = signal.butter(2, cutoff, btype="highpass", fs=sample_rate, output="sos")
    return signal.sosfilt(sos, buffer)


def bandpass(buffer: np.ndarray, center_hz: float, bandwidth_hz: float, sample_rate: int) -> np.ndarray:
    nyquist = sample_rate / 2.0 * 0.99
    half_width = max(bandwidth_hz, 1.0) / 2.0
    low = min(max(center_hz - half_width, 1.0), nyquist - 1.0)
    high = min(max(center_hz + half_width, low + 1.0), nyquist)
    sos = signal.butter(2, [low, high], btype="bandpass", fs=sample_rate, output="sos")
    return signal.sosfilt(sos, buffer)


def stereo(mono: np.ndarray, pan: float) -> np.ndarray:
    angle = (np.clip(pan, -1.0, 1.0) + 1.0) * math.pi / 4.0
    return np.column_stack((mono * math.cos(angle), mono * math.sin(angle)))


def finalize_output(mix: np.ndarray, params: dict[str, Any], velocity: float) -> np.ndarray:
    mix = drive(mix, params["drive_amount"])
    mix = mix * params["output_gain"] * velocity
    peak = float(np.max(np.abs(mix)))
    if peak > 0.0:
        target_peak = 10.0 ** (params["target_peak_dbfs"] / 20.0)
        mix = mix * (target_peak / peak)
    if not np.isfinite(mix).all():
        raise ValueError("Rendu non fini")
    return stereo(mix, params["pan"])
