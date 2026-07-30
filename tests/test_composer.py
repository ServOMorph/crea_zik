from pathlib import Path

import pytest

from crea_zik.composer import beats_to_samples, render_score, score_frame_count, validate_score
from crea_zik.models import Instrument, Patch, PatchKind, Score, ScoreEvent


def test_score_timing_is_sample_exact() -> None:
    assert beats_to_samples(4, 120) == 96_000
    instrument = Instrument(name="lead", patch_id=Patch(name="patch", kind=PatchKind.UI_CLICK, seed=1, duration_seconds=.1).id, seed=1)
    score = Score(
        name="phrase",
        seed=2,
        tempo_bpm=120,
        events=[ScoreEvent(instrument_id=instrument.id, start_beats=0, duration_beats=4, midi_note=60, velocity=.8)],
    )
    assert score_frame_count(score) == 96_000


def test_composer_renders_synchronized_deterministic_stems(tmp_path: Path) -> None:
    patch = Patch(name="patch", kind=PatchKind.UI_CLICK, seed=1, duration_seconds=.1)
    lead = Instrument(name="lead", patch_id=patch.id, seed=2, polyphony=2)
    bass = Instrument(name="bass", patch_id=patch.id, seed=3)
    score = Score(
        name="phrase",
        seed=4,
        tempo_bpm=120,
        events=[
            ScoreEvent(instrument_id=lead.id, start_beats=0, duration_beats=1, midi_note=60, velocity=.8),
            ScoreEvent(instrument_id=lead.id, start_beats=0, duration_beats=1, midi_note=64, velocity=.8),
            ScoreEvent(instrument_id=bass.id, start_beats=0, duration_beats=2, midi_note=36, velocity=.7),
        ],
    )

    first = render_score(score, [lead, bass], tmp_path / "first")
    second = render_score(score, [lead, bass], tmp_path / "second")

    assert first.frame_count == second.frame_count
    assert len(first.stem_paths) == 2
    assert first.mix_path.read_bytes() == second.mix_path.read_bytes()
    assert {path.stat().st_size for path in first.stem_paths.values()} == {first.mix_path.stat().st_size}


def test_composer_rejects_excess_polyphony() -> None:
    patch = Patch(name="patch", kind=PatchKind.UI_CLICK, seed=1, duration_seconds=.1)
    instrument = Instrument(name="lead", patch_id=patch.id, seed=2, polyphony=1)
    score = Score(
        name="invalid",
        seed=3,
        events=[
            ScoreEvent(instrument_id=instrument.id, start_beats=0, duration_beats=2, midi_note=60, velocity=.8),
            ScoreEvent(instrument_id=instrument.id, start_beats=1, duration_beats=2, midi_note=64, velocity=.8),
        ],
    )
    with pytest.raises(ValueError, match="polyphony"):
        validate_score(score, [instrument])
