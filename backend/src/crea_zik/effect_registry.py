from __future__ import annotations

import copy
from dataclasses import dataclass
from math import isfinite
from typing import Any

EFFECT_KINDS = ("eq", "saturation", "compressor", "delay", "reverb", "limiter")

DEFAULTS: dict[str, dict[str, Any]] = {
    "eq": {"freq_hz": 1000.0, "gain_db": 0.0, "q": 1.0},
    "saturation": {"drive": 0.2, "mix": 1.0},
    "compressor": {
        "threshold_db": -18.0,
        "ratio": 3.0,
        "attack_ms": 8.0,
        "release_ms": 120.0,
    },
    "delay": {"time_seconds": 0.25, "feedback": 0.3, "mix": 0.3},
    "reverb": {"send_tracks": [], "taps": []},
    "limiter": {"fade_seconds": 0.0, "normalization_peak": 0.0},
}


@dataclass(frozen=True)
class ScalarParameter:
    path: str
    label: str
    kind: str
    default: float
    minimum: float | None = None
    maximum: float | None = None
    step: float = 0.01
    unit: str = ""


@dataclass(frozen=True)
class ParameterGroup:
    id: str
    label: str
    parameters: tuple[ScalarParameter, ...] = ()


GROUPS: dict[str, tuple[ParameterGroup, ...]] = {
    "eq": (
        ParameterGroup(
            id="eq",
            label="Égalisation",
            parameters=(
                ScalarParameter("freq_hz", "Fréquence", "hz", 1000.0, 20, 20000, 1, "Hz"),
                ScalarParameter("gain_db", "Gain", "db", 0.0, -24, 24, 0.1, "dB"),
                ScalarParameter("q", "Résonance (Q)", "ratio", 1.0, 0.1, 10, 0.05, ""),
            ),
        ),
    ),
    "saturation": (
        ParameterGroup(
            id="saturation",
            label="Saturation",
            parameters=(
                ScalarParameter("drive", "Excitation", "ratio", 0.2, 0, 1, 0.01, ""),
                ScalarParameter("mix", "Mélange", "percent", 1.0, 0, 1, 0.01, ""),
            ),
        ),
    ),
    "compressor": (
        ParameterGroup(
            id="compressor",
            label="Compresseur",
            parameters=(
                ScalarParameter(
                    "threshold_db", "Seuil", "db", -18.0, -60, 0, 0.5, "dB"
                ),
                ScalarParameter("ratio", "Taux", "ratio", 3.0, 1, 20, 0.1, ":1"),
                ScalarParameter(
                    "attack_ms", "Attaque", "milliseconds", 8.0, 0, 500, 1, "ms"
                ),
                ScalarParameter(
                    "release_ms", "Relâchement", "milliseconds", 120.0, 0, 2000, 1, "ms"
                ),
            ),
        ),
    ),
    "delay": (
        ParameterGroup(
            id="delay",
            label="Délai",
            parameters=(
                ScalarParameter(
                    "time_seconds", "Temps", "seconds", 0.25, 0.001, 4, 0.001, "s"
                ),
                ScalarParameter(
                    "feedback", "Réinjection", "percent", 0.3, 0, 0.95, 0.01, ""
                ),
                ScalarParameter("mix", "Mélange", "percent", 0.3, 0, 1, 0.01, ""),
            ),
        ),
    ),
    "limiter": (
        ParameterGroup(
            id="limiter",
            label="Limiteur",
            parameters=(
                ScalarParameter(
                    "fade_seconds", "Fondu", "seconds", 0.0, 0, 30, 0.1, "s"
                ),
                ScalarParameter(
                    "normalization_peak",
                    "Crête cible",
                    "percent",
                    0.0,
                    0,
                    1,
                    0.01,
                    "",
                ),
            ),
        ),
    ),
    "reverb": (),
}


def default_parameters_for_kind(kind: str) -> dict[str, Any]:
    if kind not in DEFAULTS:
        raise ValueError(f"unknown effect kind {kind}")
    return copy.deepcopy(DEFAULTS[kind])


def _bounded(scalar: ScalarParameter, value: float) -> float:
    if not isfinite(value):
        return scalar.default
    if scalar.minimum is not None and value < scalar.minimum:
        return scalar.minimum
    if scalar.maximum is not None and value > scalar.maximum:
        return scalar.maximum
    return value


def sanitize_effect_parameters(kind: str, parameters: dict[str, Any]) -> dict[str, Any]:
    if kind not in GROUPS:
        return dict(parameters)
    sanitized = copy.deepcopy(parameters)
    for group in GROUPS[kind]:
        for parameter in group.parameters:
            raw = sanitized.get(parameter.path, parameter.default)
            try:
                value = float(raw)
            except (TypeError, ValueError):
                value = parameter.default
            sanitized[parameter.path] = _bounded(parameter, value)
    return sanitized


def registry_payload() -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for kind in EFFECT_KINDS:
        groups = GROUPS.get(kind, ())
        kind_groups: list[dict[str, Any]] = []
        for group in groups:
            kind_groups.append(
                {
                    "id": group.id,
                    "label": group.label,
                    "parameters": [
                        {
                            "type": "scalar",
                            "path": parameter.path,
                            "label": parameter.label,
                            "kind": parameter.kind,
                            "default": parameter.default,
                            "minimum": parameter.minimum,
                            "maximum": parameter.maximum,
                            "step": parameter.step,
                            "unit": parameter.unit,
                        }
                        for parameter in group.parameters
                    ],
                }
            )
        payload[kind] = {"groups": kind_groups, "defaults": DEFAULTS[kind]}
    return payload
