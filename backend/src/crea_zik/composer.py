from __future__ import annotations

from array import array
from dataclasses import dataclass
from math import pi, sin
from pathlib import Path
from wave import open as open_wave

from .models import Instrument, Score, ScoreEvent


@dataclass(frozen=True)
class RenderedScore:
    mix_path: Path
    stem_paths: dict[str, Path]
    frame_count: int


def beats_to_samples(beats: float, tempo_bpm: float, sample_rate: int = 48_000) -> int:
    return round(beats * 60 / tempo_bpm * sample_rate)


def score_frame_count(score: Score, sample_rate: int = 48_000) -> int:
    if not score.events:
        return 0
    last_beat = max(event.start_beats + event.duration_beats for event in score.events)
    return beats_to_samples(last_beat, score.tempo_bpm, sample_rate)


def validate_score(score: Score, instruments: list[Instrument]) -> None:
    instruments_by_id = {instrument.id for instrument in instruments}
    unknown = {event.instrument_id for event in score.events} - instruments_by_id
    if unknown:
        raise ValueError("score contains an unknown instrument")
    for instrument in instruments:
        events = sorted(
            (event for event in score.events if event.instrument_id == instrument.id),
            key=lambda event: (event.start_beats, event.duration_beats),
        )
        active_ends: list[float] = []
        for event in events:
            active_ends = [end for end in active_ends if end > event.start_beats]
            active_ends.append(event.start_beats + event.duration_beats)
            if len(active_ends) > instrument.polyphony:
                raise ValueError(f"instrument {instrument.name} exceeds its polyphony")


def render_score(score: Score, instruments: list[Instrument], destination: Path, sample_rate: int = 48_000) -> RenderedScore:
    validate_score(score, instruments)
    frame_count = score_frame_count(score, sample_rate)
    destination.mkdir(parents=True, exist_ok=True)
    stems: dict[str, list[float]] = {}
    for instrument in instruments:
        stem = [0.0] * frame_count
        for event in (item for item in score.events if item.instrument_id == instrument.id):
            _render_event(stem, event, score.tempo_bpm, sample_rate)
        stems[str(instrument.id)] = stem
    mix = [sum(samples[index] for samples in stems.values()) for index in range(frame_count)]
    stem_paths: dict[str, Path] = {}
    for instrument_id, samples in stems.items():
        path = destination / f"stem-{instrument_id}.wav"
        _write_wav(path, samples, sample_rate)
        stem_paths[instrument_id] = path
    mix_path = destination / "mix.wav"
    _write_wav(mix_path, mix, sample_rate)
    return RenderedScore(mix_path=mix_path, stem_paths=stem_paths, frame_count=frame_count)


def _render_event(samples: list[float], event: ScoreEvent, tempo_bpm: float, sample_rate: int) -> None:
    start = beats_to_samples(event.start_beats, tempo_bpm, sample_rate)
    length = beats_to_samples(event.duration_beats, tempo_bpm, sample_rate)
    frequency = 440 * 2 ** ((event.midi_note - 69) / 12)
    attack = min(max(1, sample_rate // 200), max(1, length // 4))
    release = attack
    for offset in range(length):
        index = start + offset
        if index >= len(samples):
            break
        envelope = min(1, offset / attack, (length - offset) / release)
        samples[index] += sin(2 * pi * frequency * offset / sample_rate) * event.velocity * .18 * envelope


def _write_wav(path: Path, samples: list[float], sample_rate: int) -> None:
    pcm = array("h")
    for sample in samples:
        value = max(-.98, min(.98, sample))
        encoded = round(value * 32_767)
        pcm.extend((encoded, encoded))
    with open_wave(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(sample_rate)
        output.writeframes(pcm.tobytes())
