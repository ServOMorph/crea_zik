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
    Clip,
    Composition,
    EffectInstance,
    MixerChannel,
    NoteEvent,
    Pattern,
    Project,
    RenderSettings,
    Track,
)
from hypothesis import assume, given
from hypothesis import strategies as st
from hypothesis.strategies import composite
from pydantic import ValidationError
from scipy.io import wavfile

_ST_TRACK_KIND = st.sampled_from(["drums", "bass", "pad", "arp", "lead"])
_ST_SAMPLE_RATE = st.sampled_from([44_100, 48_000, 88_200, 96_000])
_ST_FORMAT = st.sampled_from(["wav_pcm24", "wav_pcm16", "wav_float32"])


@composite
def _valid_compositions(draw) -> Composition:
    track_count = draw(st.integers(min_value=1, max_value=8))
    tracks = [
        Track(
            id=uuid4(),
            name=f"track-{index}",
            kind=draw(_ST_TRACK_KIND),
            gain=draw(st.floats(min_value=0, max_value=2)),
            pan=draw(st.floats(min_value=-1, max_value=1)),
        )
        for index in range(track_count)
    ]
    track_ids = [track.id for track in tracks]

    pattern_count = draw(st.integers(min_value=0, max_value=4))
    patterns = [
        Pattern(
            id=uuid4(),
            track_id=draw(st.sampled_from(track_ids)),
            events=[
                NoteEvent(
                    id=uuid4(),
                    start_beat=draw(st.floats(min_value=0, max_value=20)),
                    duration_beats=draw(st.floats(min_value=0.01, max_value=4)),
                    midi_note=draw(st.integers(min_value=0, max_value=127)),
                    velocity=draw(st.floats(min_value=0.01, max_value=1)),
                )
                for _ in range(draw(st.integers(min_value=0, max_value=4)))
            ],
        )
        for _ in range(pattern_count)
    ]
    pattern_ids = [pattern.id for pattern in patterns]

    clips = [
        Clip(
            id=uuid4(),
            pattern_id=draw(st.sampled_from(pattern_ids)),
            start_beat=draw(st.floats(min_value=0, max_value=10)),
            length_beats=draw(st.floats(min_value=0.1, max_value=10)),
            repeat_count=draw(st.integers(min_value=1, max_value=3)),
        )
        for _ in range(draw(st.integers(min_value=0, max_value=4)))
    ] if pattern_ids else []

    channel_count = draw(st.integers(min_value=0, max_value=4))
    channels: list[MixerChannel] = []
    for _ in range(channel_count):
        track_id = draw(st.sampled_from(track_ids))
        sends = {
            existing.id: draw(st.floats(min_value=0, max_value=1))
            for existing in channels
            if draw(st.booleans())
        }
        output = draw(st.sampled_from([*[c.id for c in channels], "master"]))
        mixer_track_id = track_id if draw(st.booleans()) else None
        channels.append(
            MixerChannel(
                id=uuid4(),
                track_id=mixer_track_id,
                gain=draw(st.floats(min_value=0, max_value=2)),
                pan=draw(st.floats(min_value=-1, max_value=1)),
                mute=draw(st.booleans()),
                solo=draw(st.booleans()),
                output=output,
                sends=sends,
            )
        )

    lane_count = draw(st.integers(min_value=0, max_value=4))
    lanes = [
        AutomationLane(
            id=uuid4(),
            target=f"track.{draw(st.sampled_from(track_ids))}.gain",
            points=[
                AutomationPoint(
                    beat=beat,
                    value=draw(st.floats(min_value=0, max_value=2)),
                )
                for beat in sorted(
                    draw(
                        st.sets(
                            st.floats(min_value=0, max_value=10),
                            min_size=1,
                            max_size=4,
                        )
                    )
                )
            ],
        )
        for _ in range(lane_count)
    ]

    return Composition(
        seed=draw(st.integers(min_value=0, max_value=2**63 - 1)),
        title=f"composition-{uuid4().hex[:8]}",
        sample_rate=draw(_ST_SAMPLE_RATE),
        tempo_bpm=draw(st.floats(min_value=20, max_value=400)),
        time_signature=(draw(st.integers(min_value=1, max_value=32)), 4),
        tracks=tracks,
        patterns=patterns,
        clips=clips,
        mixer_channels=channels,
        automation_lanes=lanes,
        render_settings=RenderSettings(
            duration_seconds=draw(st.floats(min_value=0.05, max_value=4)),
            format=draw(_ST_FORMAT),
        ),
    )


@composite
def _compositions_with_dangling_reference(draw) -> dict:
    composition = draw(_valid_compositions())
    kind = draw(st.sampled_from(["pattern_track", "clip_pattern", "mixer_track", "automation_track"]))
    payload = composition.model_dump(mode="json")
    if kind == "pattern_track" and payload["patterns"]:
        payload["patterns"][0]["track_id"] = str(uuid4())
    elif kind == "clip_pattern" and payload["clips"]:
        payload["clips"][0]["pattern_id"] = str(uuid4())
    elif kind == "mixer_track" and payload["mixer_channels"]:
        payload["mixer_channels"][0]["track_id"] = str(uuid4())
    elif kind == "automation_track" and payload["automation_lanes"]:
        target_track = str(uuid4())
        payload["automation_lanes"][0]["target"] = f"track.{target_track}.gain"
    else:
        assume(False)
    return payload


@given(payload=_compositions_with_dangling_reference())
def test_composition_rejects_dangling_references(payload: dict) -> None:
    with pytest.raises(ValidationError):
        Composition.model_validate(payload)


@given(composition=_valid_compositions())
def test_composition_round_trip_preserves_structure(composition: Composition) -> None:
    serialized = composition.model_dump(mode="json")
    restored = Composition.model_validate(serialized)
    assert restored == composition
    assert Composition.model_validate_json(composition.model_dump_json()) == composition


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
    assert project.schema_version == 3
    assert project.compositions == []


def test_project_schema_two_composition_patterns_gain_names_colors() -> None:
    source = reference_composition().model_dump(mode="json")
    for pattern in source["patterns"]:
        pattern.pop("name", None)
        pattern.pop("color", None)
    legacy = Project.model_validate(
        {
            "name": "legacy",
            "schema_version": 2,
            "compositions": [{**source, "schema_version": 2}],
        }
    )
    assert legacy.schema_version == 3
    migrated = legacy.compositions[0]
    assert migrated.schema_version == 3
    assert [pattern.name for pattern in migrated.patterns] == [
        f"Pattern {index + 1}" for index in range(len(migrated.patterns))
    ]
    assert all(pattern.color for pattern in migrated.patterns)


def test_composition_rejects_invalid_references_and_future_versions() -> None:
    source = reference_composition().model_dump(mode="json")
    source["schema_version"] = 4
    with pytest.raises(ValidationError):
        Composition.model_validate(source)
    source = reference_composition().model_dump(mode="json")
    source["clips"][0]["pattern_id"] = str(uuid4())
    with pytest.raises(ValidationError, match="clips must reference a pattern"):
        Composition.model_validate(source)


def test_pattern_rejects_unknown_fields_and_invalid_decorations() -> None:
    source = reference_composition()
    payload = source.model_dump(mode="json")
    pattern = payload["patterns"][0]
    with pytest.raises(ValidationError):
        Pattern.model_validate({**pattern, "mystery": 1})
    with pytest.raises(ValidationError):
        Pattern.model_validate({**pattern, "color": "red"})
    with pytest.raises(ValidationError):
        Pattern.model_validate({**pattern, "length_beats": 0})
    with pytest.raises(ValidationError):
        Pattern.model_validate({**pattern, "name": "  "})
    decorated = Pattern.model_validate(
        {**pattern, "name": "  Groove  ", "color": "#a1b2c3", "length_beats": 8}
    )
    assert decorated.name == "Groove"
    assert decorated.color == "#a1b2c3"
    assert decorated.length_beats == 8


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
    reverb = next(
        effect for effect in source.master_channel.effects if effect.kind == "reverb"
    )
    copied_reverb = next(
        effect for effect in copy.master_channel.effects if effect.kind == "reverb"
    )
    source_sends = reverb.parameters["send_tracks"]
    copied_sends = copied_reverb.parameters["send_tracks"]
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
                    NoteEvent(
                        start_beat=0,
                        midi_note=notes[track.kind],
                        duration_beats=0.4,
                        velocity=0.5,
                    )
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
        update={
            "master_channel": composition.master_channel.model_copy(
                update={"effects": []}
            )
        },
        deep=True,
    )
    dry_rendered = render_composition(dry, tmp_path / "without-effects")
    assert dry_rendered.mix_path.read_bytes() != rendered.mix_path.read_bytes()
    assert all(
        dry_rendered.stem_paths[track_id].read_bytes() == path.read_bytes()
        for track_id, path in rendered.stem_paths.items()
    )
