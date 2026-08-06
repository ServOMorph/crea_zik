from __future__ import annotations

from pathlib import Path
from uuid import uuid4

import pytest
from crea_zik.compositions import (
    composition_end_beat,
    copy_composition,
    render_composition,
    schedule_composition,
)
from crea_zik.gallery import composition_examples
from crea_zik.models import Clip, Composition, NoteEvent, Pattern, Project
from pydantic import ValidationError


def _single_clip_composition(
    *,
    start_beat: float = 0,
    length_beats: float = 1,
    repeat_count: int = 1,
    midi_note: int = 60,
) -> Composition:
    source = composition_examples()[0]
    track = source.tracks[1]
    return source.model_copy(
        update={
            "tracks": [track],
            "patterns": [
                Pattern(
                    id=source.patterns[1].id,
                    track_id=track.id,
                    events=[
                        NoteEvent(
                            id=source.patterns[1].events[0].id,
                            start_beat=0,
                            duration_beats=0.25,
                            midi_note=midi_note,
                            velocity=0.7,
                        )
                    ],
                )
            ],
            "clips": [
                Clip(
                    id=source.clips[1].id,
                    pattern_id=source.patterns[1].id,
                    start_beat=start_beat,
                    length_beats=length_beats,
                    repeat_count=repeat_count,
                )
            ],
            "mixer_channels": [],
            "render_settings": source.render_settings.model_copy(
                update={"duration_seconds": 0.5}
            ),
        },
        deep=True,
    )


def test_schema_v3_migration_adds_markers_and_clip_flags() -> None:
    source = composition_examples()[0].model_dump(mode="json")
    source["schema_version"] = 3
    source.pop("markers", None)
    for clip in source["clips"]:
        clip.pop("mute", None)
        clip.pop("locked", None)
        clip.pop("group", None)
        assert "mute" not in clip
        assert "locked" not in clip
        assert "group" not in clip
    project = Project.model_validate(
        {"name": "legacy", "schema_version": 3, "compositions": [source]}
    )
    migrated = project.compositions[0]
    assert project.schema_version == 4
    assert migrated.schema_version == 4
    assert migrated.markers == []
    assert all(not clip.mute and not clip.locked and clip.group is None for clip in migrated.clips)


def test_marker_validation_rejects_negative_beats_blank_labels_and_unknown_fields() -> None:
    source = composition_examples()[0]
    payload = source.model_dump(mode="json")
    with pytest.raises(ValidationError):
        Composition.model_validate(
            {**payload, "markers": [{"id": str(uuid4()), "beat": -1, "label": "intro"}]}
        )
    with pytest.raises(ValidationError):
        Composition.model_validate(
            {**payload, "markers": [{"id": str(uuid4()), "beat": 0, "label": "  "}]}
        )
    with pytest.raises(ValidationError):
        Composition.model_validate(
            {**payload, "markers": [{"id": str(uuid4()), "beat": 0, "label": "intro", "mystery": 1}]}
        )


def test_marker_identifiers_must_be_unique() -> None:
    source = composition_examples()[0]
    payload = source.model_dump(mode="json")
    shared_id = str(uuid4())
    with pytest.raises(ValidationError, match="marker identifiers"):
        Composition.model_validate(
            {
                **payload,
                "markers": [
                    {"id": shared_id, "beat": 0, "label": "intro"},
                    {"id": shared_id, "beat": 8, "label": "groove"},
                ],
            }
        )


def test_clip_flags_and_group_round_trip_are_preserved() -> None:
    source = composition_examples()[0]
    decorated = source.model_copy(
        update={
            "clips": [
                source.clips[0].model_copy(
                    update={"mute": True, "locked": True, "group": "  section A  "}
                ),
                *source.clips[1:],
            ]
        },
        deep=True,
    )
    restored = Composition.model_validate(decorated.model_dump(mode="json"))
    assert restored.clips[0].mute is True
    assert restored.clips[0].locked is True
    assert restored.clips[0].group == "section A"


def test_clip_group_rejects_path_segments() -> None:
    source = composition_examples()[0]
    with pytest.raises(ValidationError):
        Clip.model_validate(
            {
                **source.clips[0].model_dump(mode="json"),
                "group": "../secret",
            }
        )


def test_composition_end_beat_includes_repetitions_and_ignores_nothing() -> None:
    single = _single_clip_composition(start_beat=2, length_beats=3, repeat_count=2)
    assert composition_end_beat(single) == pytest.approx(8)
    empty = single.model_copy(update={"clips": []}, deep=True)
    assert composition_end_beat(empty) == 0


def test_muted_clip_schedules_no_event_and_changes_render(tmp_path: Path) -> None:
    original = _single_clip_composition()
    assert len(schedule_composition(original)) == 1
    muted = original.model_copy(
        update={"clips": [original.clips[0].model_copy(update={"mute": True})]},
        deep=True,
    )
    assert schedule_composition(muted) == []
    original_render = render_composition(original, tmp_path / "original")
    muted_render = render_composition(muted, tmp_path / "muted")
    track_id = str(original.tracks[0].id)
    assert original_render.stem_paths[track_id].read_bytes() != muted_render.stem_paths[track_id].read_bytes()


def test_clip_transposition_is_applied_by_the_scheduler() -> None:
    composition = _single_clip_composition(midi_note=60)
    transposed = composition.model_copy(
        update={
            "clips": [composition.clips[0].model_copy(update={"transposition": 12})]
        },
        deep=True,
    )
    scheduled = schedule_composition(transposed)
    assert len(scheduled) == 1
    assert scheduled[0].midi_note == 72


def test_copy_reassigns_marker_identifiers_and_keeps_labels() -> None:
    source = composition_examples()[0]
    copied = copy_composition(source)
    assert {marker.id for marker in copied.markers}.isdisjoint(
        marker.id for marker in source.markers
    )
    assert [marker.label for marker in copied.markers] == [
        marker.label for marker in source.markers
    ]
    assert [marker.beat for marker in copied.markers] == [
        marker.beat for marker in source.markers
    ]


def test_markers_do_not_affect_the_rendered_audio(tmp_path: Path) -> None:
    source = composition_examples()[0]
    short = source.model_copy(
        update={
            "render_settings": source.render_settings.model_copy(
                update={"duration_seconds": 0.2}
            )
        },
        deep=True,
    )
    without_markers = short.model_copy(update={"markers": []}, deep=True)
    with_markers = render_composition(short, tmp_path / "with-markers")
    no_markers = render_composition(without_markers, tmp_path / "without-markers")
    assert with_markers.mix_path.read_bytes() == no_markers.mix_path.read_bytes()
    assert with_markers.stem_paths.keys() == no_markers.stem_paths.keys()
    for track_id, stem in with_markers.stem_paths.items():
        assert stem.read_bytes() == no_markers.stem_paths[track_id].read_bytes()


def test_track_kind_of_a_reference_section_is_reproducible() -> None:
    source = composition_examples()[0]
    assert [marker.beat for marker in source.markers] == [0, 8, 16, 24, 48]
    assert [marker.label for marker in source.markers] == [
        "intro",
        "groove",
        "montée",
        "climax",
        "outro",
    ]
