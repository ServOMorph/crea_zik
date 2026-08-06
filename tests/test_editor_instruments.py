from __future__ import annotations

import hashlib
import math
import re
from pathlib import Path
from uuid import uuid4

import numpy as np
import pytest
from crea_zik.api import app
from crea_zik.composition_dsp import synthesize
from crea_zik.compositions import render_composition
from crea_zik.gallery import composition_examples
from crea_zik.instrument_registry import (
    GROUPS,
    TRACK_KINDS,
    ScalarParameter,
    default_parameters,
    registry_payload,
    sanitize_parameters,
    set_parameter_path,
)
from fastapi.testclient import TestClient
from hypothesis import given
from hypothesis import strategies as st

SAMPLE_RATE = 48_000


def _real_path(path: str) -> str:
    return re.sub(r"\[\]", "[0]", path)


def _kind_scalars(kind: str) -> list[ScalarParameter]:
    scalars: list[ScalarParameter] = []
    for group in GROUPS[kind]:
        for parameter in group.parameters:
            if isinstance(parameter, ScalarParameter):
                scalars.append(parameter)
            else:
                for field in parameter.fields:
                    scalars.append(
                        ScalarParameter(
                            path=_real_path(field.path),
                            label=field.label,
                            kind=field.kind,
                            default=field.default,
                            minimum=field.minimum,
                            maximum=field.maximum,
                            step=field.step,
                            unit=field.unit,
                        )
                    )
    return scalars


def _read_path(parameters: dict, path: str) -> float:
    current = parameters
    for piece in path.split("."):
        if "[" in piece and "]" in piece:
            key, index = piece.split("[")
            current = current[key][int(index[:-1])]
        elif isinstance(current, list) and piece.isdigit():
            current = current[int(piece)]
        else:
            current = current[piece]
    return float(current)


def _set_path(parameters: dict, path: str, value: float) -> dict:
    pieces = path.split(".")
    current = parameters
    for index, piece in enumerate(pieces):
        last = index == len(pieces) - 1
        if "[" in piece:
            key, rest = piece.split("[")
            index_value = int(rest[:-1])
            if last:
                current[key][index_value] = value
                return parameters
            current = current[key][index_value]
        elif last:
            if isinstance(current, list) and piece.isdigit():
                current[int(piece)] = value
            else:
                current[piece] = value
        else:
            if isinstance(current, list) and piece.isdigit():
                current = current[int(piece)]
            else:
                current = current.setdefault(piece, {})
    return parameters


@pytest.mark.parametrize("kind", TRACK_KINDS)
def test_default_parameters_match_canonical_fixture(kind: str) -> None:
    source = composition_examples()[0]
    track = next(track for track in source.tracks if track.kind == kind)
    assert track.instrument.parameters == default_parameters(kind)


@pytest.mark.parametrize("kind", TRACK_KINDS)
def test_sanitize_is_identity_on_defaults(kind: str) -> None:
    assert sanitize_parameters(kind, default_parameters(kind)) == default_parameters(
        kind
    )


@pytest.mark.parametrize("kind", TRACK_KINDS)
def test_sanitize_replaces_non_finite_values_with_defaults(kind: str) -> None:
    defaults = default_parameters(kind)
    for parameter in _kind_scalars(kind):
        if parameter.minimum is None and parameter.maximum is None:
            continue
        corrupted = _set_path(defaults, parameter.path, float("nan"))
        result = sanitize_parameters(kind, corrupted)
        value = _read_path(result, parameter.path)
        assert math.isfinite(value), f"{kind} {parameter.path}"


@pytest.mark.parametrize("kind", TRACK_KINDS)
def test_sanitize_clamps_scalars_to_registry_bounds(kind: str) -> None:
    for parameter in _kind_scalars(kind):
        if parameter.minimum is None or parameter.maximum is None:
            continue
        bounded, updated = set_parameter_path(
            kind, default_parameters(kind), parameter.path, parameter.maximum * 10
        )
        assert bounded == parameter.maximum, f"{kind} {parameter.path}"
        bounded, updated = set_parameter_path(
            kind, default_parameters(kind), parameter.path, parameter.minimum - 1
        )
        assert bounded == parameter.minimum, f"{kind} {parameter.path}"
        assert math.isfinite(_read_path(updated, parameter.path))


@pytest.mark.parametrize("kind", TRACK_KINDS)
def test_sanitize_preserves_unknown_keys(kind: str) -> None:
    defaults = default_parameters(kind)
    defaults["custom_key"] = {"nested": [1, 2]}
    result = sanitize_parameters(kind, defaults)
    assert result["custom_key"] == {"nested": [1, 2]}


def test_set_parameter_path_bounds_scalar_and_list_items() -> None:
    defaults = default_parameters("bass")
    bounded, updated = set_parameter_path("bass", defaults, "envelope.sustain", 3.0)
    assert bounded == 1
    assert updated["envelope"]["sustain"] == 1
    bounded, updated = set_parameter_path(
        "bass", defaults, "oscillators[1].ratio", 40.0
    )
    assert bounded == 8
    assert updated["oscillators"][1]["ratio"] == 8
    value, updated = set_parameter_path("bass", defaults, "unknown.path", 5.0)
    assert value == 5.0


@pytest.mark.parametrize("kind", TRACK_KINDS)
def test_fixture_defaults_stay_inside_registry_bounds(kind: str) -> None:
    defaults = default_parameters(kind)
    for parameter in _kind_scalars(kind):
        try:
            value = _read_path(defaults, parameter.path)
        except KeyError:
            continue
        if parameter.minimum is not None:
            assert value >= parameter.minimum, f"{kind} {parameter.path}"
        if parameter.maximum is not None:
            assert value <= parameter.maximum, f"{kind} {parameter.path}"


@pytest.mark.parametrize("kind", TRACK_KINDS)
def test_every_default_key_is_exposed_by_the_registry(kind: str) -> None:
    exposed = _exposed_templates(kind)
    for key in _flatten(default_parameters(kind)):
        assert _matches_any(key, exposed), f"{kind}: {key} non exposé"


def _flatten(parameters: dict, prefix: str = "") -> set[str]:
    paths: set[str] = set()
    for key, value in parameters.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            paths |= _flatten(value, path)
        elif isinstance(value, list) and value and isinstance(value[0], dict):
            for index in range(len(value)):
                paths |= {f"{path}[{index}].{sub}" for sub in value[index]}
        else:
            paths.add(path)
    return paths


def _exposed_templates(kind: str) -> set[str]:
    templates: set[str] = set()
    for group in GROUPS[kind]:
        for parameter in group.parameters:
            if isinstance(parameter, ScalarParameter):
                templates.add(parameter.path)
            else:
                templates.add(parameter.path)
                for field in parameter.fields:
                    templates.add(field.path)
    return templates


def _matches_any(path: str, templates: set[str]) -> bool:
    for template in templates:
        if "[]" in template:
            if re.sub(r"\[\d+\]", "[]", path) == template:
                return True
        elif (
            path == template
            or path.startswith(f"{template}.")
            or template.startswith(f"{path}.")
        ):
            return True
    return False


@pytest.mark.parametrize("kind", TRACK_KINDS)
def test_parameter_corner_cases_stay_finite_and_render(kind: str) -> None:
    for parameter in _kind_scalars(kind):
        if parameter.minimum is None or parameter.maximum is None:
            continue
        for value in (
            parameter.minimum,
            parameter.maximum,
            parameter.default,
            parameter.minimum * 0.5,
            parameter.maximum * 2,
            math.nan,
            math.inf,
        ):
            parameters = _set_path(default_parameters(kind), parameter.path, value)
            audio = synthesize(
                track_kind=kind,
                midi_note=60,
                duration_seconds=0.5,
                amplitude=0.8,
                parameters=parameters,
                sample_rate=SAMPLE_RATE,
                seed=1,
            )
            assert np.all(np.isfinite(audio)), f"{kind} {parameter.path} {value}"
            assert float(np.max(np.abs(audio))) < 100, (
                f"{kind} {parameter.path} {value}"
            )


@given(
    rate_hz=st.floats(min_value=0, max_value=20),
    depth_semitones=st.floats(min_value=0, max_value=1),
    attack=st.floats(min_value=0, max_value=5),
    ratio=st.floats(min_value=0.25, max_value=8),
    gain=st.floats(min_value=0, max_value=2),
)
def test_hypothesis_lead_combinations_render_finite(
    rate_hz, depth_semitones, attack, ratio, gain
) -> None:
    parameters = default_parameters("lead")
    parameters["vibrato"]["rate_hz"] = rate_hz
    parameters["vibrato"]["depth_semitones"] = depth_semitones
    parameters["envelope"]["attack"] = attack
    parameters["oscillators"][0]["ratio"] = ratio
    parameters["oscillators"][0]["gain"] = gain
    audio = synthesize(
        track_kind="lead",
        midi_note=60,
        duration_seconds=1.0,
        amplitude=0.8,
        parameters=parameters,
        sample_rate=SAMPLE_RATE,
        seed=3,
    )
    assert np.all(np.isfinite(audio))
    assert float(np.max(np.abs(audio))) < 100


def test_sanitize_bandpass_swaps_and_clamps_bounds() -> None:
    result = sanitize_parameters("drums", {"clap": {"bandpass_hz": [9000, 850]}})
    assert result["clap"]["bandpass_hz"] == [850, 9000]
    result = sanitize_parameters("drums", {"clap": {}})
    assert result["clap"]["bandpass_hz"] == [850, 9000]


def test_sanitize_clap_bursts_is_sorted_and_bounded() -> None:
    result = sanitize_parameters("drums", {"clap": {"bursts_seconds": [0.4, 0.1, 999]}})
    assert result["clap"]["bursts_seconds"] == [0.1, 0.4, 0.5]


def test_registry_payload_matches_metadata_and_defaults() -> None:
    payload = registry_payload()
    assert set(payload) == set(TRACK_KINDS)
    for kind in TRACK_KINDS:
        assert payload[kind]["defaults"] == default_parameters(kind)
        for group in payload[kind]["groups"]:
            for parameter in group["parameters"]:
                if parameter["type"] == "scalar":
                    minimum, maximum = parameter["minimum"], parameter["maximum"]
                    if minimum is not None and maximum is not None:
                        assert minimum <= parameter["default"] <= maximum
                    assert parameter["default"] == _read_path(
                        default_parameters(kind), _real_path(parameter["path"])
                    )


def test_instrument_registry_endpoint_returns_typed_payload(
    tmp_path, monkeypatch
) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    response = client.get("/api/instrument-registry")
    assert response.status_code == 200
    payload = response.json()
    assert set(payload) == set(TRACK_KINDS)
    assert len(payload["drums"]["groups"]) == 4


def test_instrument_preview_endpoint_renders_finite_wav(tmp_path, monkeypatch) -> None:
    project_root = tmp_path / "projects"
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", project_root)
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "preview"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    composition = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    ).json()
    track = composition["tracks"][1]
    response = client.post(
        f"/api/projects/{project['id']}/compositions/{composition['id']}/instrument-preview",
        json={"track_id": track["id"], "midi_note": 60},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["sample_rate"] == SAMPLE_RATE
    assert payload["peak"] > 0
    assert not payload["is_clipping"]
    assert math.isfinite(payload["peak"])
    assert (project_root / payload["wav"]).resolve().is_file()


def test_instrument_preview_rejects_unknown_track(tmp_path, monkeypatch) -> None:
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", tmp_path / "projects")
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", tmp_path / "projects")
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "preview"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    composition = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    ).json()
    response = client.post(
        f"/api/projects/{project['id']}/compositions/{composition['id']}/instrument-preview",
        json={"track_id": str(uuid4()), "midi_note": 60},
    )
    assert response.status_code == 422


def test_instrument_preview_sanitizes_supplied_parameters(tmp_path, monkeypatch) -> None:
    project_root = tmp_path / "projects"
    monkeypatch.setattr("crea_zik.api.PROJECT_ROOT", project_root)
    monkeypatch.setattr("crea_zik.cli.PROJECT_ROOT", project_root)
    client = TestClient(app)
    project = client.post("/api/projects", json={"name": "preview"}).json()
    source = client.get("/api/composition-gallery").json()[0]
    composition = client.post(
        f"/api/projects/{project['id']}/compositions",
        json={"example_id": source["id"]},
    ).json()
    track = next(item for item in composition["tracks"] if item["kind"] == "bass")
    response = client.post(
        f"/api/projects/{project['id']}/compositions/{composition['id']}/instrument-preview",
        json={
            "track_id": track["id"],
            "midi_note": 60,
            "parameters": {"lowpass_hz": 99999, "envelope": {"sustain": 999, "decay": -50}},
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert math.isfinite(payload["peak"])
    assert not payload["is_clipping"]
    assert (project_root / payload["wav"]).resolve().is_file()


def test_editing_an_instrument_parameter_changes_the_render(tmp_path: Path) -> None:
    source = composition_examples()[0]
    changed = source.model_copy(deep=True)
    bass = next(track for track in changed.tracks if track.kind == "bass")
    bass.instrument.parameters["lowpass_hz"] = 2000.0
    destination = tmp_path / "render"
    render_composition(source, destination, cancelled=lambda: False)
    original_hash = hashlib.sha256((destination / "mix.wav").read_bytes()).hexdigest()
    changed_destination = tmp_path / "render-changed"
    render_composition(changed, changed_destination, cancelled=lambda: False)
    changed_hash = hashlib.sha256(
        (changed_destination / "mix.wav").read_bytes()
    ).hexdigest()
    assert changed_hash != original_hash
