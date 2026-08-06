from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import numpy as np
import pytest
from crea_zik.compositions import (
    copy_composition,
    evaluate_automation,
    evaluate_automation_values,
    render_composition,
    with_demo_automations,
)
from crea_zik.gallery import composition_examples
from crea_zik.models import (
    AutomationLane,
    AutomationPoint,
    Composition,
    MixerChannel,
    NoteEvent,
    Pattern,
    RenderSettings,
    Track,
)
from hypothesis import given
from hypothesis import strategies as st
from scipy.io import wavfile


def _pad_reference() -> Composition:
    source = composition_examples()[0]
    return source.model_copy(
        update={
            "render_settings": source.render_settings.model_copy(
                update={"duration_seconds": 1.0}
            )
        },
        deep=True,
    )


def _lane(
    target: str,
    points: list[AutomationPoint],
) -> AutomationLane:
    return AutomationLane(target=target, points=points)


def test_interpolations_match_analytic_values() -> None:
    lane = _lane(
        "track.abc.gain",
        [
            AutomationPoint(beat=0, value=0, interpolation="step"),
            AutomationPoint(beat=4, value=10, interpolation="linear"),
            AutomationPoint(beat=8, value=0, interpolation="smooth"),
        ],
    )
    assert evaluate_automation(lane, 0) == 0
    assert evaluate_automation(lane, 2) == 0
    assert evaluate_automation(lane, 3.999) == 0
    assert evaluate_automation(lane, 4) == 10
    assert evaluate_automation(lane, 6) == 5
    assert evaluate_automation(lane, 8) == 0
    smooth_mid = evaluate_automation(lane, 6)
    assert smooth_mid == pytest.approx(5)
    before = evaluate_automation(lane, 5.5)
    after = evaluate_automation(lane, 6.5)
    assert before > 5 > after


def test_smooth_interpolation_is_continuously_differentiable() -> None:
    lane = _lane(
        "track.abc.gain",
        [
            AutomationPoint(beat=0, value=0, interpolation="smooth"),
            AutomationPoint(beat=4, value=10, interpolation="smooth"),
        ],
    )
    beats = np.linspace(0, 4, 1000)
    values = evaluate_automation_values(lane, beats)
    slope = np.gradient(values, beats)
    assert slope.min() >= -1e-9
    assert values.min() >= -1e-9
    midpoint_slope = slope[500]
    assert midpoint_slope > 0.01
    assert abs(slope[0]) < midpoint_slope / 100
    assert abs(slope[-1]) < midpoint_slope / 100
    interior = slice(50, -50)
    analytic_slope = (10 / 4) * 6 * (beats[interior] / 4) * (1 - beats[interior] / 4)
    assert np.allclose(slope[interior], analytic_slope, rtol=0.02)
    assert np.allclose(values, 10 * (beats / 4) ** 2 * (3 - 2 * beats / 4))


def test_step_interpolation_produces_quantized_levels() -> None:
    lane = _lane(
        "track.abc.gain",
        [
            AutomationPoint(beat=0, value=1, interpolation="step"),
            AutomationPoint(beat=4, value=0.25, interpolation="step"),
            AutomationPoint(beat=8, value=1, interpolation="step"),
        ],
    )
    beats = np.linspace(-1, 9, 200)
    values = evaluate_automation_values(lane, beats)
    np.testing.assert_array_equal(values[: int(len(beats) * 0.5)], 1)
    np.testing.assert_array_equal(values[int(len(beats) * 0.5) : int(len(beats) * 0.75)], 0.25)


def test_evaluate_automation_values_matches_scalar_evaluation() -> None:
    lane = _lane(
        "track.abc.pan",
        [
            AutomationPoint(beat=0, value=-1, interpolation="step"),
            AutomationPoint(beat=2, value=0, interpolation="linear"),
            AutomationPoint(beat=5, value=1, interpolation="smooth"),
        ],
    )
    beats = np.linspace(-1, 6, 40)
    values = evaluate_automation_values(lane, beats)
    for beat, value in zip(beats, values, strict=True):
        assert value == pytest.approx(evaluate_automation(lane, float(beat)))


def test_evaluate_automation_values_keeps_constant_extrapolation() -> None:
    lane = _lane(
        "track.abc.gain",
        [
            AutomationPoint(beat=2, value=3, interpolation="linear"),
            AutomationPoint(beat=4, value=5, interpolation="linear"),
        ],
    )
    beats = np.array([-5, 0, 1, 2, 4, 7, 99])
    values = evaluate_automation_values(lane, beats)
    assert values[0] == 3
    assert values[1] == 3
    assert values[2] == 3
    assert values[3] == 3
    assert values[4] == 5
    assert values[5] == 5
    assert values[6] == 5


def test_automation_gain_overrides_track_gain_and_removal_restores_base(
    tmp_path: Path,
) -> None:
    source = _pad_reference()
    pad = source.tracks[2]
    base = source.tracks[2].gain
    autom = source.model_copy(
        update={
            "automation_lanes": [
                _lane(
                    f"track.{pad.id}.gain",
                    [AutomationPoint(beat=0, value=base * 0.2, interpolation="step")],
                )
            ]
        },
        deep=True,
    )
    rendered_automated = render_composition(autom, tmp_path / "automated").mix_path
    rendered_base = render_composition(source, tmp_path / "base").mix_path
    assert rendered_automated.read_bytes() != rendered_base.read_bytes()
    restored = source.model_copy(
        update={
            "automation_lanes": [
                _lane(
                    f"track.{pad.id}.gain",
                    [AutomationPoint(beat=0, value=base, interpolation="step")],
                )
            ]
        },
        deep=True,
    )
    assert (
        render_composition(restored, tmp_path / "restored").mix_path.read_bytes()
        == rendered_base.read_bytes()
    )


def test_muted_track_silences_automated_gain(tmp_path: Path) -> None:
    source = _pad_reference()
    pad = source.tracks[2]
    base = source.tracks[2].gain
    muted = source.model_copy(
        update={
            "mixer_channels": [MixerChannel(track_id=pad.id, mute=True)],
            "automation_lanes": [
                _lane(
                    f"track.{pad.id}.gain",
                    [AutomationPoint(beat=0, value=base, interpolation="step")],
                )
            ],
        },
        deep=True,
    )
    rendered = render_composition(muted, tmp_path / "muted").mix_path
    rate, data = wavfile.read(rendered)
    assert data.max() == 0 or abs(float(data.max())) < 1e-4


def test_gain_automation_is_sample_continuous_without_zipper(tmp_path: Path) -> None:
    source = _pad_reference()
    pad = source.tracks[2]
    lane = _lane(
        f"track.{pad.id}.gain",
        [
            AutomationPoint(beat=0, value=1, interpolation="linear"),
            AutomationPoint(beat=4, value=0.01, interpolation="linear"),
        ],
    )
    automated = source.model_copy(
        update={
            "automation_lanes": [lane],
            "master_channel": source.master_channel.model_copy(
                update={"effects": []}
            ),
        },
        deep=True,
    )
    rendered = render_composition(
        automated, tmp_path / "smooth", track_ids={pad.id}
    ).mix_path
    rate, data = wavfile.read(rendered)
    mono = np.asarray(data, dtype=np.float64).mean(axis=1) / 2_147_483_647.0
    nonzero = mono[np.abs(mono) > 1e-6]
    assert len(nonzero) > 100
    differences = np.abs(np.diff(nonzero))
    assert differences.max() < 0.5
    assert differences.min() >= 0


def test_parameter_automation_overrides_instrument_base_value(
    tmp_path: Path,
) -> None:
    source = _pad_reference()
    pad = source.tracks[2]
    low = source.model_copy(
        update={
            "automation_lanes": [
                _lane(
                    f"track.{pad.id}.parameter.lowpass_hz",
                    [AutomationPoint(beat=0, value=200.0, interpolation="step")],
                )
            ]
        },
        deep=True,
    )
    rendered_low = render_composition(low, tmp_path / "low").mix_path
    rendered_base = render_composition(source, tmp_path / "base").mix_path
    assert rendered_low.read_bytes() != rendered_base.read_bytes()


def test_nested_parameter_target_is_accepted() -> None:
    lane = _lane(
        "track.abc.parameter.oscillators[0].ratio",
        [AutomationPoint(beat=0, value=2, interpolation="linear")],
    )
    assert lane.target == "track.abc.parameter.oscillators[0].ratio"


def test_copy_composition_remaps_automation_targets() -> None:
    source = _pad_reference()
    pad = source.tracks[2]
    source = source.model_copy(
        update={
            "automation_lanes": [
                _lane(
                    f"track.{pad.id}.gain",
                    [AutomationPoint(beat=0, value=0.5, interpolation="step")],
                )
            ]
        },
        deep=True,
    )
    copied = copy_composition(source)
    assert len(copied.automation_lanes) == 1
    copied_target = copied.automation_lanes[0].target
    assert copied_target != f"track.{pad.id}.gain"
    assert copied_target == f"track.{copied.tracks[2].id}.gain"


def test_demo_automations_leave_reference_immutable_and_tag_editable_copy() -> None:
    reference = composition_examples()[0]
    original = reference.model_dump(mode="json")
    demo = with_demo_automations(copy_composition(reference))
    assert reference.model_dump(mode="json") == original
    assert demo.automation_lanes
    targets = {lane.target for lane in demo.automation_lanes}
    demo_track_ids = {str(track.id) for track in demo.tracks}
    for target in targets:
        _, identifier, _ = target.split(".", 2)
        assert identifier in demo_track_ids


def test_demo_automations_match_contract_schema() -> None:
    import json

    from jsonschema import Draft202012Validator, FormatChecker

    schema_path = Path(__file__).resolve().parents[1] / "EDITEUR" / "contracts"
    schema = json.loads(
        (schema_path / "composition.schema.json").read_text(encoding="utf-8")
    )
    reference = composition_examples()[0]
    demo = with_demo_automations(copy_composition(reference))
    data = json.loads(demo.model_dump_json())
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    errors = sorted(
        validator.iter_errors(data), key=lambda error: list(error.path)
    )
    assert not errors, "\n".join(error.message for error in errors)


def test_demo_automations_render_deterministically(tmp_path: Path) -> None:
    reference = composition_examples()[0]
    demo = with_demo_automations(copy_composition(reference))
    demo = demo.model_copy(
        update={
            "render_settings": demo.render_settings.model_copy(
                update={"duration_seconds": 0.4}
            )
        },
        deep=True,
    )
    first = render_composition(demo, tmp_path / "first").mix_path.read_bytes()
    second = render_composition(demo, tmp_path / "second").mix_path.read_bytes()
    assert first == second


@given(
    st.lists(
        st.floats(min_value=0, max_value=100_000, allow_nan=False, allow_infinity=False),
        min_size=1,
        max_size=20,
    )
)
def test_automation_evaluation_is_deterministic_on_any_beat_sequence(
    beats: list[float],
) -> None:
    lane = _lane(
        "track.abc.gain",
        [
            AutomationPoint(beat=0, value=0, interpolation="linear"),
            AutomationPoint(beat=50_000, value=1, interpolation="smooth"),
        ],
    )
    arr = np.asarray(beats, dtype=np.float64)
    first = evaluate_automation_values(lane, arr)
    second = evaluate_automation_values(lane, arr)
    np.testing.assert_array_equal(first, second)
