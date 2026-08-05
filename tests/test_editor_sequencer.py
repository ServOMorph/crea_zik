from __future__ import annotations

from pathlib import Path

import numpy as np
from crea_zik.compositions import render_composition
from crea_zik.gallery import composition_examples
from crea_zik.models import Clip, Composition, MixerChannel, NoteEvent, Pattern, Track
from scipy.io import wavfile


def _drum_only_composition(
    *,
    midi_note: int = 36,
    start_beat: float = 0,
    duration_beats: float = 0.25,
    velocity: float = 0.7,
    micro_timing: float = 0,
    probability: float = 1,
    duration_seconds: float = 0.5,
) -> Composition:
    source = composition_examples()[0]
    track = source.tracks[0]
    return source.model_copy(
        update={
            "tracks": [
                Track(
                    id=track.id,
                    name=track.name,
                    kind=track.kind,
                    instrument=track.instrument,
                )
            ],
            "patterns": [
                Pattern(
                    id=source.patterns[0].id,
                    track_id=track.id,
                    events=[
                        NoteEvent(
                            id=source.patterns[0].events[0].id,
                            start_beat=start_beat,
                            duration_beats=duration_beats,
                            midi_note=midi_note,
                            velocity=velocity,
                            probability=probability,
                            micro_timing_beats=micro_timing,
                        )
                    ],
                )
            ],
            "clips": [
                Clip(
                    id=source.clips[0].id,
                    pattern_id=source.patterns[0].id,
                    start_beat=0,
                    length_beats=1,
                )
            ],
            "mixer_channels": [],
            "render_settings": source.render_settings.model_copy(
                update={"duration_seconds": duration_seconds}
            ),
        },
        deep=True,
    )


def _first_nonzero_sample(path: Path) -> int:
    _, audio = wavfile.read(path)
    samples = audio.astype(np.float64) if audio.ndim == 1 else audio[:, 0]
    nonzero = np.flatnonzero(np.abs(samples) > 0)
    return int(nonzero[0]) if len(nonzero) else -1


def test_probability_zero_silences_only_its_track(tmp_path: Path) -> None:
    original = _drum_only_composition()
    gated = original.model_copy(
        update={
            "patterns": [
                pattern.model_copy(
                    update={
                        "events": [
                            event.model_copy(update={"probability": 0})
                            for event in pattern.events
                        ]
                    }
                )
                for pattern in original.patterns
            ]
        },
        deep=True,
    )
    rendered = render_composition(original, tmp_path / "original")
    muted = render_composition(gated, tmp_path / "muted")
    track_id = str(original.tracks[0].id)
    assert _first_nonzero_sample(muted.stem_paths[track_id]) == -1
    assert _first_nonzero_sample(rendered.stem_paths[track_id]) >= 0


def test_probability_gate_is_seeded_deterministic(tmp_path: Path) -> None:
    composition = _drum_only_composition(probability=0.5)
    first = render_composition(composition, tmp_path / "first")
    second = render_composition(composition, tmp_path / "second")
    assert first.mix_path.read_bytes() == second.mix_path.read_bytes()
    assert first.stem_paths[str(composition.tracks[0].id)].read_bytes() == second.stem_paths[
        str(composition.tracks[0].id)
    ].read_bytes()


def test_micro_timing_shifts_the_onset(tmp_path: Path) -> None:
    baseline = _drum_only_composition(micro_timing=0)
    shifted = _drum_only_composition(micro_timing=0.5)
    baseline_render = render_composition(baseline, tmp_path / "baseline")
    shifted_render = render_composition(shifted, tmp_path / "shifted")
    track_id = str(baseline.tracks[0].id)
    baseline_onset = _first_nonzero_sample(baseline_render.stem_paths[track_id])
    shifted_onset = _first_nonzero_sample(shifted_render.stem_paths[track_id])
    expected_shift = round(0.5 * 60 / baseline.tempo_bpm * baseline.sample_rate)
    assert baseline_onset != shifted_onset
    assert abs((shifted_onset - baseline_onset) - expected_shift) <= 1


def test_toggling_a_step_changes_only_its_track_stem(tmp_path: Path) -> None:
    source = composition_examples()[0]
    drums_pattern = next(
        pattern
        for pattern in source.patterns
        if pattern.track_id == source.tracks[0].id
    )
    kick = next(
        event for event in drums_pattern.events if event.midi_note == 36
    )
    without_kick = source.model_copy(
        update={
            "patterns": [
                pattern.model_copy(
                    update={
                        "events": [
                            event
                            for event in pattern.events
                            if event.id != kick.id
                        ]
                    }
                )
                if pattern.id == drums_pattern.id
                else pattern
                for pattern in source.patterns
            ]
        },
        deep=True,
    )
    original = render_composition(source, tmp_path / "original")
    toggled = render_composition(without_kick, tmp_path / "toggled")
    drums_id = str(source.tracks[0].id)
    assert toggled.stem_paths[drums_id].read_bytes() != original.stem_paths[drums_id].read_bytes()
    for track in source.tracks[1:]:
        track_id = str(track.id)
        assert toggled.stem_paths[track_id].read_bytes() == original.stem_paths[track_id].read_bytes()


def test_mixer_mute_and_solo_are_respected_by_render(tmp_path: Path) -> None:
    source = composition_examples()[0]
    drums = source.tracks[0]
    muted = source.model_copy(
        update={"mixer_channels": [MixerChannel(track_id=drums.id, mute=True)]},
        deep=True,
    )
    original = render_composition(source, tmp_path / "original")
    result = render_composition(muted, tmp_path / "muted")
    assert result.mix_path.read_bytes() != original.mix_path.read_bytes()
    soloed = source.model_copy(
        update={"mixer_channels": [MixerChannel(track_id=drums.id, solo=True)]},
        deep=True,
    )
    solo_render = render_composition(soloed, tmp_path / "soloed")
    assert solo_render.mix_path.read_bytes() != original.mix_path.read_bytes()
