from __future__ import annotations

import copy
import re
from dataclasses import dataclass
from math import isfinite
from typing import Any

TRACK_KINDS = ("drums", "bass", "pad", "arp", "lead")

DEFAULTS: dict[str, dict[str, Any]] = {
    "drums": {
        "kick": {
            "frequency_hz": {"base": 47, "drop": 112, "decay": 30},
            "body_decay": 9.5,
            "click_hz": 1900,
            "click_decay": 65,
            "click_gain": 0.09,
        },
        "clap": {
            "duration_seconds": 0.22,
            "bandpass_hz": [850, 9000],
            "bursts_seconds": [0, 0.018, 0.036],
            "burst_width_seconds": 0.011,
            "decay": 7,
        },
        "hat": {"duration_seconds": 0.085, "highpass_hz": 6800, "decay": 52},
    },
    "bass": {
        "oscillators": [
            {"ratio": 1, "gain": 1},
            {"ratio": 2, "gain": 0.33},
            {"ratio": 3, "gain": 0.12},
        ],
        "lowpass_hz": 620,
        "envelope": {"attack": 0.008, "decay": 0.12, "sustain": 0.72, "release": 0.07},
    },
    "pad": {
        "oscillators": [
            {"detune_semitones": -0.004, "gain": 0.18},
            {"detune_semitones": 0, "gain": 0.3},
            {"detune_semitones": 0.003, "gain": 0.18},
            {"ratio": 2, "gain": 0.16},
        ],
        "lowpass_hz": 2400,
        "envelope": {"attack": 0.65, "decay": 1.2, "sustain": 0.7, "release": 0.8},
    },
    "arp": {
        "oscillators": [
            {"ratio": 1, "gain": 1},
            {"ratio": 2, "gain": 0.34},
            {"ratio": 3, "gain": 0.14},
        ],
        "decay": 4.5,
        "envelope": {"attack": 0.006, "decay": 0.11, "sustain": 0.4, "release": 0.22},
    },
    "lead": {
        "vibrato": {"depth_semitones": 0.004, "rate_hz": 5.2},
        "oscillators": [
            {"ratio": 1, "gain": 1},
            {"ratio": 2, "gain": 0.23},
            {"ratio": 3, "gain": 0.07},
        ],
        "envelope": {"attack": 0.025, "decay": 0.18, "sustain": 0.68, "release": 0.2},
    },
}

_PATH_INDEX = re.compile(r"^([a-z0-9_]+)\[(\d+)\]$")


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
class ListParameter:
    path: str
    label: str
    item_label: str
    min_items: int
    max_items: int
    fields: tuple[ScalarParameter, ...]


@dataclass(frozen=True)
class ParameterGroup:
    id: str
    label: str
    parameters: tuple[ScalarParameter | ListParameter, ...] = ()


def default_parameters(track_kind: str) -> dict[str, Any]:
    if track_kind not in DEFAULTS:
        raise ValueError(f"unknown track kind {track_kind}")
    return copy.deepcopy(DEFAULTS[track_kind])


def _read(container: Any, path: str) -> Any:
    current = container
    for piece in path.split("."):
        match = _PATH_INDEX.match(piece)
        if match:
            key, index = match.group(1), int(match.group(2))
            current = current[key][index]
        elif isinstance(current, list) and piece.isdigit():
            current = current[int(piece)]
        else:
            current = current[piece]
    return current


def _write(container: dict[str, Any], path: str, value: Any) -> None:
    pieces = path.split(".")
    current: Any = container
    for index, piece in enumerate(pieces):
        last = index == len(pieces) - 1
        match = _PATH_INDEX.match(piece)
        if match:
            key, item_index = match.group(1), int(match.group(2))
            if last:
                current[key][item_index] = value
            else:
                current = current[key][item_index]
            continue
        if last:
            if isinstance(current, list) and piece.isdigit():
                current[int(piece)] = value
            else:
                current[piece] = value
        else:
            if isinstance(current, list) and piece.isdigit():
                current = current[int(piece)]
            else:
                current = current.setdefault(piece, {})


def _item_field_key(field: ScalarParameter) -> str:
    return field.path.split("[]", 1)[1][1:]


def _first_item(kind: str, path: str, field_key: str) -> float:
    try:
        items = _read(DEFAULTS[kind], path)
        return float(items[0][field_key])
    except (KeyError, IndexError, TypeError, ValueError):
        return {"ratio": 1.0, "gain": 1.0, "detune_semitones": 0.0}.get(field_key, 0.0)


def _default_value(kind: str, path: str) -> float:
    if "[]" in path:
        root, _, rest = path.partition("[]")
        field_key = rest.lstrip(".")
        return _first_item(kind, root, field_key)
    try:
        return float(_read(DEFAULTS[kind], path))
    except (KeyError, IndexError, TypeError, ValueError):
        return 0.0


def _scalar(
    kind: str,
    path: str,
    label: str,
    p_kind: str,
    minimum: float,
    maximum: float,
    step: float,
    unit: str,
) -> ScalarParameter:
    return ScalarParameter(
        path=path,
        label=label,
        kind=p_kind,
        default=_default_value(kind, path),
        minimum=minimum,
        maximum=maximum,
        step=step,
        unit=unit,
    )


def _envelope_group(kind: str) -> ParameterGroup:
    return ParameterGroup(
        id="envelope",
        label="Enveloppe",
        parameters=(
            _scalar(kind, "envelope.attack", "Attaque", "seconds", 0, 5, 0.001, "s"),
            _scalar(kind, "envelope.decay", "Chute", "seconds", 0, 5, 0.001, "s"),
            _scalar(kind, "envelope.sustain", "Maintien", "percent", 0, 1, 0.01, ""),
            _scalar(
                kind, "envelope.release", "Relâchement", "seconds", 0, 5, 0.001, "s"
            ),
        ),
    )


def _oscillators_group(kind: str, *, detune: bool) -> ParameterGroup:
    fields: list[ScalarParameter] = []
    if detune:
        fields.append(
            _scalar(
                kind,
                "oscillators[].detune_semitones",
                "Désaccord",
                "semitones",
                -0.5,
                0.5,
                0.001,
                "st",
            )
        )
        fields.append(
            _scalar(kind, "oscillators[].ratio", "Ratio", "ratio", 0.25, 8, 0.01, "")
        )
    else:
        fields.append(
            _scalar(kind, "oscillators[].ratio", "Ratio", "ratio", 0.25, 8, 0.01, "")
        )
    fields.append(
        _scalar(kind, "oscillators[].gain", "Gain", "percent", 0, 2, 0.01, "")
    )
    return ParameterGroup(
        id="oscillators",
        label="Oscillateurs",
        parameters=(
            ListParameter(
                path="oscillators",
                label="Oscillateurs",
                item_label="Harmonique",
                min_items=1,
                max_items=8,
                fields=tuple(fields),
            ),
        ),
    )


GROUPS: dict[str, tuple[ParameterGroup, ...]] = {
    "drums": (
        ParameterGroup(
            id="kick",
            label="Grosse caisse",
            parameters=(
                _scalar(
                    "drums",
                    "kick.frequency_hz.base",
                    "Fondamental",
                    "hz",
                    20,
                    200,
                    1,
                    "Hz",
                ),
                _scalar(
                    "drums",
                    "kick.frequency_hz.drop",
                    "Chute de hauteur",
                    "hz",
                    0,
                    200,
                    1,
                    "Hz",
                ),
                _scalar(
                    "drums",
                    "kick.frequency_hz.decay",
                    "Vitesse de chute",
                    "seconds",
                    1,
                    100,
                    1,
                    "1/s",
                ),
                _scalar(
                    "drums",
                    "kick.body_decay",
                    "Décroissance du corps",
                    "seconds",
                    1,
                    50,
                    0.1,
                    "1/s",
                ),
                _scalar(
                    "drums", "kick.click_hz", "Clic (Hz)", "hz", 500, 8000, 10, "Hz"
                ),
                _scalar(
                    "drums",
                    "kick.click_decay",
                    "Décroissance du clic",
                    "seconds",
                    5,
                    200,
                    1,
                    "1/s",
                ),
                _scalar(
                    "drums",
                    "kick.click_gain",
                    "Gain du clic",
                    "percent",
                    0,
                    0.5,
                    0.001,
                    "",
                ),
            ),
        ),
        ParameterGroup(
            id="clap",
            label="Clap",
            parameters=(
                _scalar(
                    "drums",
                    "clap.duration_seconds",
                    "Durée",
                    "seconds",
                    0.05,
                    1,
                    0.01,
                    "s",
                ),
                _scalar(
                    "drums",
                    "clap.bandpass_hz.0",
                    "Passe-bande bas",
                    "hz",
                    20,
                    10000,
                    10,
                    "Hz",
                ),
                _scalar(
                    "drums",
                    "clap.bandpass_hz.1",
                    "Passe-bande haut",
                    "hz",
                    100,
                    20000,
                    10,
                    "Hz",
                ),
                _scalar(
                    "drums",
                    "clap.burst_width_seconds",
                    "Largeur des bursts",
                    "seconds",
                    0.001,
                    0.1,
                    0.001,
                    "s",
                ),
                _scalar(
                    "drums", "clap.decay", "Décroissance", "seconds", 1, 50, 0.1, "1/s"
                ),
            ),
        ),
        ParameterGroup(
            id="clap_bursts",
            label="Bursts du clap",
            parameters=(
                ListParameter(
                    path="clap.bursts_seconds",
                    label="Bursts",
                    item_label="Burst",
                    min_items=1,
                    max_items=6,
                    fields=(
                        _scalar(
                            "drums",
                            "clap.bursts_seconds[]",
                            "Position",
                            "seconds",
                            0,
                            0.5,
                            0.001,
                            "s",
                        ),
                    ),
                ),
            ),
        ),
        ParameterGroup(
            id="hat",
            label="Charleston",
            parameters=(
                _scalar(
                    "drums",
                    "hat.duration_seconds",
                    "Durée",
                    "seconds",
                    0.02,
                    0.5,
                    0.001,
                    "s",
                ),
                _scalar(
                    "drums", "hat.highpass_hz", "Passe-haut", "hz", 500, 20000, 10, "Hz"
                ),
                _scalar(
                    "drums", "hat.decay", "Décroissance", "seconds", 5, 200, 1, "1/s"
                ),
            ),
        ),
    ),
    "bass": (
        _oscillators_group("bass", detune=False),
        ParameterGroup(
            id="filter",
            label="Filtre",
            parameters=(
                _scalar("bass", "lowpass_hz", "Passe-bas", "hz", 20, 20000, 10, "Hz"),
            ),
        ),
        _envelope_group("bass"),
    ),
    "pad": (
        _oscillators_group("pad", detune=True),
        ParameterGroup(
            id="filter",
            label="Filtre",
            parameters=(
                _scalar("pad", "lowpass_hz", "Passe-bas", "hz", 20, 20000, 10, "Hz"),
            ),
        ),
        _envelope_group("pad"),
    ),
    "arp": (
        _oscillators_group("arp", detune=False),
        ParameterGroup(
            id="decay",
            label="Décroissance",
            parameters=(
                _scalar("arp", "decay", "Décroissance", "seconds", 0.1, 30, 0.1, "1/s"),
            ),
        ),
        _envelope_group("arp"),
    ),
    "lead": (
        ParameterGroup(
            id="vibrato",
            label="Vibrato",
            parameters=(
                _scalar(
                    "lead",
                    "vibrato.depth_semitones",
                    "Profondeur",
                    "semitones",
                    0,
                    1,
                    0.001,
                    "st",
                ),
                _scalar("lead", "vibrato.rate_hz", "Fréquence", "hz", 0, 20, 0.1, "Hz"),
            ),
        ),
        _oscillators_group("lead", detune=False),
        _envelope_group("lead"),
    ),
}


def _bounded(scalar: ScalarParameter, value: float) -> float:
    if not isfinite(value):
        return scalar.default
    if scalar.minimum is not None and value < scalar.minimum:
        return scalar.minimum
    if scalar.maximum is not None and value > scalar.maximum:
        return scalar.maximum
    return value


def _scalar_value(parameters: dict[str, Any], scalar: ScalarParameter) -> float:
    try:
        return float(_read(parameters, scalar.path))
    except (KeyError, IndexError, TypeError, ValueError):
        return scalar.default


def _list_is_scalar(item: ListParameter) -> bool:
    return len(item.fields) == 1 and item.fields[0].path == f"{item.path}[]"


def _clamp_list(parameters: dict[str, Any], item: ListParameter) -> None:
    try:
        raw = _read(parameters, item.path)
    except (KeyError, IndexError, TypeError):
        raw = None
    if _list_is_scalar(item):
        field = item.fields[0]
        if not isinstance(raw, list) or not all(
            isinstance(value, (int, float)) for value in raw
        ):
            _write(parameters, item.path, [field.default])
            return
        bounded = [_bounded(field, float(value)) for value in raw[: item.max_items]]
        if item.path == "clap.bursts_seconds":
            bounded = sorted(bounded)
        _write(parameters, item.path, bounded)
        return
    if not isinstance(raw, list):
        _write(
            parameters,
            item.path,
            [{_item_field_key(field): field.default for field in item.fields}],
        )
        return
    normalized: list[dict[str, Any]] = []
    for entry in raw[: item.max_items]:
        if not isinstance(entry, dict):
            continue
        for field in item.fields:
            key = _item_field_key(field)
            if key in entry:
                entry[key] = _bounded(field, float(entry[key]))
        normalized.append(entry)
    if not normalized:
        normalized = [{_item_field_key(field): field.default for field in item.fields}]
    _write(parameters, item.path, normalized)


def sanitize_parameters(track_kind: str, parameters: dict[str, Any]) -> dict[str, Any]:
    if track_kind not in GROUPS:
        return dict(parameters)
    sanitized = copy.deepcopy(parameters)
    for group in GROUPS[track_kind]:
        for parameter in group.parameters:
            if isinstance(parameter, ListParameter):
                _clamp_list(sanitized, parameter)
            else:
                value = _scalar_value(sanitized, parameter)
                if not isfinite(value):
                    value = parameter.default
                bounded = _bounded(parameter, value)
                _write(sanitized, parameter.path, bounded)
    if track_kind == "drums":
        bandpass_fields = [
            parameter
            for group in GROUPS["drums"]
            for parameter in group.parameters
            if isinstance(parameter, ScalarParameter)
            and parameter.path in ("clap.bandpass_hz.0", "clap.bandpass_hz.1")
        ]
        bandpass = sanitized.get("clap", {}).get("bandpass_hz")
        if (
            not isinstance(bandpass, list)
            or len(bandpass) != 2
            or not all(isfinite(float(value)) for value in bandpass)
        ):
            bandpass = [850, 9000]
        low = _bounded(bandpass_fields[0], float(bandpass[0]))
        high = _bounded(bandpass_fields[1], float(bandpass[1]))
        if low > high:
            low, high = high, low
        sanitized["clap"]["bandpass_hz"] = [low, high]
    return sanitized


def set_parameter_path(
    track_kind: str,
    parameters: dict[str, Any],
    path: str,
    value: float,
) -> tuple[float, dict[str, Any]]:
    parameter = _find_scalar(track_kind, path)
    if parameter is None:
        return value, parameters
    bounded = _bounded(parameter, value)
    updated = copy.deepcopy(parameters)
    _write(updated, path, bounded)
    return bounded, sanitize_parameters(track_kind, updated)


def _find_scalar(track_kind: str, path: str) -> ScalarParameter | None:
    normalized = re.sub(r"\[\d+\]", "[]", path)
    for group in GROUPS.get(track_kind, ()):
        for parameter in group.parameters:
            if isinstance(parameter, ListParameter):
                for field in parameter.fields:
                    if field.path == normalized:
                        return field
            elif parameter.path == normalized:
                return parameter
    return None


def registry_payload() -> dict[str, Any]:
    payload: dict[str, Any] = {}
    for kind, groups in GROUPS.items():
        kind_groups: list[dict[str, Any]] = []
        for group in groups:
            parameters: list[dict[str, Any]] = []
            for parameter in group.parameters:
                if isinstance(parameter, ListParameter):
                    parameters.append(
                        {
                            "type": "list",
                            "path": parameter.path,
                            "label": parameter.label,
                            "itemLabel": parameter.item_label,
                            "minItems": parameter.min_items,
                            "maxItems": parameter.max_items,
                            "fields": [
                                {
                                    "path": field.path,
                                    "label": field.label,
                                    "kind": field.kind,
                                    "default": field.default,
                                    "minimum": field.minimum,
                                    "maximum": field.maximum,
                                    "step": field.step,
                                    "unit": field.unit,
                                }
                                for field in parameter.fields
                            ],
                        }
                    )
                else:
                    parameters.append(
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
                    )
            kind_groups.append(
                {"id": group.id, "label": group.label, "parameters": parameters}
            )
        payload[kind] = {"groups": kind_groups, "defaults": DEFAULTS[kind]}
    return payload
