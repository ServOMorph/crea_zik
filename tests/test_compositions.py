from __future__ import annotations

from pathlib import Path
from uuid import UUID, uuid4

import numpy as np
import pytest
from crea_zik.compositions import (
    beats_to_samples,
    copy_composition,
    render_composition,
    schedule_composition,
)
from crea_zik.gallery import composition_examples
from crea_zik.models import (
    AutomationLane,
    AutomationPoint,
    Composition,
    EffectInstance,
    MixerChannel,
    Project,
)
from hypothesis import given
from hypothesis import strategies as st
from pydantic import ValidationError
from scipy.io import wavfile


def reference_composition() -> Composition:
    return composition_examples()[0]


def short_reference() -> Composition:
    source = reference_composition()
    return source.model_copy(
        update={
            "render_settings": source.render_settings.model_copy(
                update={"duration_seconds": 0.2}
            )
        },
        deep=True,
    )


@given(
    beats=st.floats(
        min_value=0, max_value=10_000, allow_nan=False, allow_infinity=False
    ),
    tempo=st.floats(min_value=20, max_value=320, allow_nan=False, allow_infinity=False),
    sample_rate=st.sampled_from([22_050, 44_100, 48_000, 96_000]),
)
def test_beats_to_samples_is_deterministic_and_non_negative(
    beats: float, tempo: float, sample_rate: int
) -> None:
    expected = round(beats * 60 / tempo * sample_rate)
    assert beats_to_samples(beats, tempo, sample_rate) == expected
    assert beats_to_samples(beats, tempo, sample_rate) >= 0


def test_legacy_project_payload_migrates_to_composition_schema() -> None:
    project = Project.model_validate({"name": "legacy", "schema_version": 1})
    assert project.schema_version == 2
    assert project.compositions == []


def test_composition_rejects_invalid_references_and_future_versions() -> None:
    source = reference_composition().model_dump(mode="json")
    source["schema_version"] = 3
    with pytest.raises(ValidationError):
        Composition.model_validate(source)
    source = reference_composition().model_dump(mode="json")
    source["clips"][0]["pattern_id"] = str(uuid4())
    with pytest.raises(ValidationError, match="clips must reference a pattern"):
        Composition.model_validate(source)


def test_composition_rejects_mixer_cycles_and_invalid_automation_target() -> None:
    source = reference_composition()
    first = MixerChannel(track_id=source.tracks[0].id)
    second = MixerChannel(track_id=source.tracks[1].id, output=first.id)
    with pytest.raises(ValidationError, match="cycle"):
        Composition.model_validate(
            {
                **source.model_dump(mode="json"),
                "mixer_channels": [
                    first.model_copy(update={"output": second.id}).model_dump(
                        mode="json"
                    ),
                    second.model_dump(mode="json"),
                ],
            }
        )
    with pytest.raises(ValidationError, match="automation target"):
        Composition.model_validate(
            {
                **source.model_dump(mode="json"),
                "automation_lanes": [
                    AutomationLane(
                        target=f"track.{uuid4()}.gain",
                        points=[AutomationPoint(beat=0, value=1)],
                    ).model_dump(mode="json")
                ],
            }
        )


def test_reference_schedules_five_tracks_and_copy_reassigns_identifiers() -> None:
    source = reference_composition()
    original = source.model_dump(mode="json")
    source = source.model_copy(
        update={
            "tracks": [
                source.tracks[0].model_copy(
                    update={"processors": [EffectInstance(kind="drive")]}
                ),
                *source.tracks[1:],
            ]
        },
        deep=True,
    )
    copy = copy_composition(source)
    assert {event.track_id for event in schedule_composition(source)} == {
        track.id for track in source.tracks
    }
    assert source.id != copy.id
    assert {track.id for track in source.tracks}.isdisjoint(
        track.id for track in copy.tracks
    )
    assert {pattern.id for pattern in source.patterns}.isdisjoint(
        pattern.id for pattern in copy.patterns
    )
    assert source.tracks[0].processors[0].id != copy.tracks[0].processors[0].id
    track_ids = {
        source_track.id: copied_track.id
        for source_track, copied_track in zip(source.tracks, copy.tracks, strict=True)
    }
    source_sends = source.mixer["effects"][0]["send_tracks"]
    copied_sends = copy.mixer["effects"][0]["send_tracks"]
    assert copied_sends == [str(track_ids[UUID(value)]) for value in source_sends]
    assert reference_composition().model_dump(mode="json") == original


def test_clip_repetition_repeats_its_scheduled_events() -> None:
    source = reference_composition()
    original_count = sum(
        event.track_id == source.tracks[0].id for event in schedule_composition(source)
    )
    repeated_clip = source.clips[0].model_copy(update={"repeat_count": 2})
    repeated = source.model_copy(
        update={"clips": [repeated_clip, *source.clips[1:]]}, deep=True
    )
    repeated_count = sum(
        event.track_id == source.tracks[0].id
        for event in schedule_composition(repeated)
    )
    assert repeated_count == original_count * 2


def test_composition_renders_aligned_deterministic_stems_and_reacts_to_spec(
    tmp_path: Path,
) -> None:
    source = short_reference()
    first = render_composition(source, tmp_path / "first")
    second = render_composition(source, tmp_path / "second")
    third = render_composition(source, tmp_path / "third")
    assert (
        first.mix_path.read_bytes()
        == second.mix_path.read_bytes()
        == third.mix_path.read_bytes()
    )
    assert len(first.stem_paths) == 5
    assert {path.stat().st_size for path in first.stem_paths.values()} == {
        first.mix_path.stat().st_size
    }
    pad = source.tracks[2]
    gain_changed = source.model_copy(
        update={
            "tracks": [
                *source.tracks[:2],
                pad.model_copy(update={"gain": 0.1}),
                *source.tracks[3:],
            ]
        },
        deep=True,
    )
    assert (
        render_composition(
            gain_changed, tmp_path / "gain-changed"
        ).mix_path.read_bytes()
        != first.mix_path.read_bytes()
    )
    instrument = pad.instrument.model_copy(
        update={"parameters": {**pad.instrument.parameters, "frequency_ratio": 0.5}}
    )
    synth_changed = source.model_copy(
        update={
            "tracks": [
                *source.tracks[:2],
                pad.model_copy(update={"instrument": instrument}),
                *source.tracks[3:],
            ]
        },
        deep=True,
    )
    assert (
        render_composition(
            synth_changed, tmp_path / "synth-changed"
        ).mix_path.read_bytes()
        != first.mix_path.read_bytes()
    )
    mix_changed = source.model_copy(
        update={"mixer_channels": [MixerChannel(track_id=pad.id, gain=0.1)]}, deep=True
    )
    assert (
        render_composition(mix_changed, tmp_path / "mix-changed").mix_path.read_bytes()
        != first.mix_path.read_bytes()
    )


def test_composition_render_can_target_a_track_and_a_beat_range(tmp_path: Path) -> None:
    source = short_reference()
    selected = render_composition(
        source,
        tmp_path / "selected",
        track_ids={source.tracks[0].id},
        start_beat=.1,
        end_beat=.2,
    )
    assert set(selected.stem_paths) == {str(source.tracks[0].id)}
    assert selected.frame_count == beats_to_samples(.1, source.tempo_bpm, source.sample_rate)
    assert selected.mix_path.is_file()

    with pytest.raises(ValueError, match="greater than"):
        render_composition(source, tmp_path / "invalid-range", start_beat=.2, end_beat=.1)


def test_composition_render_preserves_five_distinct_instruments_and_mix_effects(
    tmp_path: Path,
) -> None:
    source = reference_composition()
    notes = {"drums": 36, "bass": 45, "pad": 57, "arp": 64, "lead": 69}
    patterns = [
        pattern.model_copy(
            update={
                "events": [
                    {
                        "start_beat": 0,
                        "midi_note": notes[track.kind],
                        "duration_beats": 0.4,
                        "velocity": 0.5,
                    }
                ]
            },
            deep=True,
        )
        for pattern, track in zip(source.patterns, source.tracks, strict=True)
    ]
    clips = [
        clip.model_copy(update={"length_beats": 0.5}, deep=True)
        for clip in source.clips
    ]
    composition = source.model_copy(
        update={
            "patterns": patterns,
            "clips": clips,
            "render_settings": source.render_settings.model_copy(
                update={"duration_seconds": 0.25, "format": "wav_float32"}
            ),
        },
        deep=True,
    )
    rendered = render_composition(composition, tmp_path / "with-effects")
    stem_audio = [
        wavfile.read(path)[1].astype(np.float64)
        for path in rendered.stem_paths.values()
    ]
    assert all(float(np.sqrt(np.mean(audio**2))) > 0.001 for audio in stem_audio)
    assert len({path.read_bytes() for path in rendered.stem_paths.values()}) == 5

    _, mix = wavfile.read(rendered.mix_path)
    assert float(np.max(np.abs(mix))) == pytest.approx(0.89, abs=1e-5)

    dry = composition.model_copy(
        update={"mixer": {**composition.mixer, "effects": []}},
        deep=True,
    )
    dry_rendered = render_composition(dry, tmp_path / "without-effects")
    assert dry_rendered.mix_path.read_bytes() != rendered.mix_path.read_bytes()
    assert all(
        dry_rendered.stem_paths[track_id].read_bytes() == path.read_bytes()
        for track_id, path in rendered.stem_paths.items()
    )
