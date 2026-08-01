from __future__ import annotations

from pathlib import Path

import numpy as np
import pytest
from crea_zik.composition_dsp import synthesize
from crea_zik.compositions import render_composition
from crea_zik.models import Clip, Composition, Pattern, RenderSettings, Track
from crea_zik.plugins import render_plugin, resolve_params


def test_drums_plugin_voice_matches_direct_plugin_render() -> None:
    params = resolve_params("kick", "808_sub", {"seed": 4200})
    direct_audio, sample_rate = render_plugin("kick", params, velocity=1.0)
    direct_mono = direct_audio.mean(axis=1)

    voice = synthesize(
        track_kind="drums",
        midi_note=36,
        duration_seconds=0.5,
        amplitude=1.0,
        parameters={
            "plugin_id": "kick",
            "plugin_preset": "808_sub",
            "plugin_overrides": {"seed": 4200},
        },
        sample_rate=sample_rate,
        seed=4200,
    )

    assert voice.shape == direct_mono.shape
    assert np.array_equal(voice, direct_mono)


def test_drums_plugin_voice_applies_composition_amplitude() -> None:
    quiet = synthesize(
        track_kind="drums",
        midi_note=36,
        duration_seconds=0.5,
        amplitude=0.25,
        parameters={"plugin_id": "kick", "plugin_preset": "techno"},
        sample_rate=48_000,
        seed=1,
    )
    loud = synthesize(
        track_kind="drums",
        midi_note=36,
        duration_seconds=0.5,
        amplitude=1.0,
        parameters={"plugin_id": "kick", "plugin_preset": "techno"},
        sample_rate=48_000,
        seed=1,
    )

    assert np.allclose(quiet, loud * 0.25)


def test_drums_without_plugin_id_keeps_legacy_hardcoded_kick() -> None:
    parameters = {"kick": {"frequency_hz": {"base": 47, "drop": 112, "decay": 30}}}
    first = synthesize(
        track_kind="drums",
        midi_note=36,
        duration_seconds=0.5,
        amplitude=1.0,
        parameters=parameters,
        sample_rate=48_000,
        seed=1,
    )
    second = synthesize(
        track_kind="drums",
        midi_note=36,
        duration_seconds=0.5,
        amplitude=1.0,
        parameters=parameters,
        sample_rate=48_000,
        seed=1,
    )

    assert np.array_equal(first, second)
    assert not np.allclose(first, np.zeros_like(first))


def test_drums_plugin_voice_rejects_unknown_plugin_id() -> None:
    with pytest.raises(ValueError):
        synthesize(
            track_kind="drums",
            midi_note=36,
            duration_seconds=0.5,
            amplitude=1.0,
            parameters={"plugin_id": "does_not_exist"},
            sample_rate=48_000,
            seed=1,
        )


def test_composition_renders_a_promoted_plugin_drum_track(tmp_path: Path) -> None:
    track = Track(
        name="Kick promu",
        kind="drums",
        instrument={
            "parameters": {
                "plugin_id": "kick",
                "plugin_preset": "techno",
                "plugin_overrides": {"seed": 77},
            }
        },
    )
    pattern = Pattern(
        track_id=track.id,
        events=[{"start_beat": 0, "duration_beats": 0.5, "midi_note": 36, "velocity": 1.0}],
    )
    clip = Clip(pattern_id=pattern.id, start_beat=0, length_beats=1)
    composition = Composition(
        seed=77,
        title="Test promotion kick",
        tempo_bpm=120,
        tracks=[track],
        patterns=[pattern],
        clips=[clip],
        render_settings=RenderSettings(duration_seconds=1),
    )

    rendered = render_composition(composition, tmp_path)

    assert rendered.mix_path.is_file()
    assert rendered.frame_count > 0
    assert len(rendered.stem_paths) == 1
