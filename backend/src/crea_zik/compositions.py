from __future__ import annotations

from collections.abc import Callable, Collection
from dataclasses import dataclass, replace
from itertools import pairwise
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import numpy as np

from .composition_dsp import Audio, add, reverb, stereo, synthesize, write_wav
from .engine import RenderCancelled
from .models import AutomationLane, Clip, Composition, EffectInstance, Pattern, Track


@dataclass(frozen=True)
class ScheduledCompositionEvent:
    track_id: UUID
    track_kind: str
    start_beat: float
    duration_beats: float
    midi_note: int
    velocity: float
    pan: float


@dataclass(frozen=True)
class RenderedComposition:
    mix_path: Path
    stem_paths: dict[str, Path]
    frame_count: int


def beats_to_samples(beats: float, tempo_bpm: float, sample_rate: int) -> int:
    return round(beats * 60 / tempo_bpm * sample_rate)


def schedule_composition(composition: Composition) -> list[ScheduledCompositionEvent]:
    patterns = {pattern.id: pattern for pattern in composition.patterns}
    tracks = {track.id: track for track in composition.tracks}
    scheduled: list[ScheduledCompositionEvent] = []
    for clip in composition.clips:
        pattern = patterns[clip.pattern_id]
        track = tracks[pattern.track_id]
        for repeat in range(clip.repeat_count):
            occurrence = clip.model_copy(
                update={"start_beat": clip.start_beat + repeat * clip.length_beats}
            )
            scheduled.extend(
                _schedule_clip(
                    pattern, occurrence, track, composition.time_signature[0]
                )
            )
    return sorted(
        scheduled,
        key=lambda event: (event.start_beat, str(event.track_id), event.midi_note),
    )


def _schedule_clip(
    pattern: Pattern, clip: Clip, track: Track, beats_per_bar: int
) -> list[ScheduledCompositionEvent]:
    events: list[ScheduledCompositionEvent] = []
    end = clip.start_beat + clip.length_beats
    for raw_event in pattern.events:
        if "notes" in raw_event:
            for start, midi_note in raw_event["notes"]:
                events.append(
                    _event(
                        track,
                        clip,
                        float(start),
                        float(raw_event.get("duration_beats", 0.25)),
                        int(midi_note),
                        float(raw_event.get("gain", raw_event.get("velocity", 1))),
                        raw_event.get("pan", 0),
                    )
                )
            continue
        if "start_beat" in raw_event and "midi_note" in raw_event:
            events.append(
                _event(
                    track,
                    clip,
                    float(raw_event["start_beat"]),
                    float(raw_event.get("duration_beats", 0.25)),
                    int(raw_event["midi_note"]),
                    float(raw_event.get("velocity", 1)),
                    raw_event.get("pan", 0),
                )
            )
            continue
        events.extend(_schedule_repeated_event(raw_event, clip, track, beats_per_bar))
    return [event for event in events if clip.start_beat <= event.start_beat < end]


def _schedule_repeated_event(
    raw_event: dict[str, Any], clip: Clip, track: Track, beats_per_bar: int
) -> list[ScheduledCompositionEvent]:
    events: list[ScheduledCompositionEvent] = []
    first_bar = int(raw_event.get("from_bar", 0))
    last_bar = int((clip.length_beats - 1) // beats_per_bar)
    until_bar = min(last_bar + 1, int(raw_event.get("until_bar", last_bar + 1)))
    roots = [int(value) for value in raw_event.get("roots_midi", [60])]
    intervals = [int(value) for value in raw_event.get("intervals", [0])]
    duration = float(raw_event.get("duration_beats", 0.25))
    gain = _event_gain(raw_event.get("gain", 1), first_bar)
    pans = raw_event.get("pan", 0)
    for bar in range(first_bar, until_bar):
        bar_start = bar * beats_per_bar
        root = roots[bar % len(roots)]
        if "beats" in raw_event:
            for index, beat in enumerate(raw_event["beats"]):
                events.append(
                    _event(
                        track,
                        clip,
                        bar_start + float(beat),
                        duration,
                        _drum_midi(str(raw_event.get("kind", "drums"))),
                        gain,
                        _pan_at(pans, index),
                    )
                )
        elif "notes_per_bar" in raw_event:
            for index, offset in enumerate(raw_event["notes_per_bar"]):
                events.append(
                    _event(
                        track,
                        clip,
                        bar_start + _beat_offset(float(offset), beats_per_bar),
                        duration,
                        root,
                        gain,
                        _pan_at(pans, index),
                    )
                )
        elif "pattern" in raw_event:
            step = float(raw_event.get("step_beats", 0.25))
            for index, interval_index in enumerate(raw_event["pattern"]):
                events.append(
                    _event(
                        track,
                        clip,
                        bar_start + index * step,
                        duration,
                        root + intervals[int(interval_index) % len(intervals)],
                        gain,
                        _pan_at(pans, index),
                    )
                )
        else:
            for index, interval in enumerate(intervals):
                events.append(
                    _event(
                        track,
                        clip,
                        bar_start,
                        duration,
                        root + interval,
                        gain,
                        _pan_at(pans, index),
                    )
                )
    return events


def _event(
    track: Track,
    clip: Clip,
    start_beat: float,
    duration_beats: float,
    midi_note: int,
    velocity: float,
    pan: Any,
) -> ScheduledCompositionEvent:
    return ScheduledCompositionEvent(
        track_id=track.id,
        track_kind=track.kind,
        start_beat=clip.start_beat + start_beat,
        duration_beats=duration_beats,
        midi_note=max(0, min(127, midi_note + clip.transposition)),
        velocity=max(0, min(1, velocity)),
        pan=max(-1, min(1, float(pan if not isinstance(pan, list) else pan[0]))),
    )


def _event_gain(value: Any, bar: int) -> float:
    if not isinstance(value, dict):
        return float(value)
    threshold = int(value.get("from_bar", 0))
    return float(value.get("value_after" if bar >= threshold else "value", 1))


def _pan_at(value: Any, index: int) -> float:
    if isinstance(value, list) and value:
        return float(value[index % len(value)])
    return float(value)


def _beat_offset(value: float, beats_per_bar: int) -> float:
    return value if value <= beats_per_bar else value / 6


def _drum_midi(kind: str) -> int:
    return {"kick": 36, "clap": 39, "hat": 42}.get(kind, 36)


def evaluate_automation(lane: AutomationLane, beat: float) -> float:
    points = lane.points
    if beat <= points[0].beat:
        return points[0].value
    for left, right in pairwise(points):
        if beat <= right.beat:
            if left.interpolation == "step":
                return left.value
            progress = (beat - left.beat) / (right.beat - left.beat)
            return left.value + (right.value - left.value) * progress
    return points[-1].value


def render_composition(
    composition: Composition,
    destination: Path,
    *,
    track_ids: Collection[UUID] | None = None,
    start_beat: float = 0,
    end_beat: float | None = None,
    cancelled: Callable[[], bool] | None = None,
    progress: Callable[[int], None] | None = None,
) -> RenderedComposition:
    if start_beat < 0:
        raise ValueError("start_beat must be non-negative")
    total_beats = composition.render_settings.duration_seconds * composition.tempo_bpm / 60
    end_beat = total_beats if end_beat is None else min(end_beat, total_beats)
    if end_beat <= start_beat:
        raise ValueError("end_beat must be greater than start_beat")
    selected_track_ids = set(track_ids) if track_ids is not None else None
    destination.mkdir(parents=True, exist_ok=True)
    frame_count = beats_to_samples(
        end_beat - start_beat, composition.tempo_bpm, composition.sample_rate
    )
    tracks = {
        track.id: track
        for track in composition.tracks
        if selected_track_ids is None or track.id in selected_track_ids
    }
    if not tracks:
        raise ValueError("track_ids must reference at least one composition track")
    stems = {
        track_id: np.zeros((frame_count, 2), dtype=np.float64)
        for track_id in tracks
    }
    lanes = {lane.target: lane for lane in composition.automation_lanes}
    channels = {
        channel.track_id: channel
        for channel in composition.mixer_channels
        if channel.track_id
    }
    soloed = {channel.track_id for channel in channels.values() if channel.solo}
    events = [
        event
        for event in schedule_composition(composition)
        if event.track_id in tracks
        and event.start_beat < end_beat
        and event.start_beat + event.duration_beats > start_beat
    ]
    if cancelled and cancelled():
        raise RenderCancelled("render cancelled")
    if progress:
        progress(15)
    for index, event in enumerate(events, start=1):
        if cancelled and cancelled():
            raise RenderCancelled("render cancelled")
        track = tracks[event.track_id]
        channel = channels.get(track.id)
        if channel and (channel.mute or soloed and not channel.solo):
            continue
        channel_gain = channel.gain if channel else 1
        channel_pan = channel.pan if channel else 0
        gain = (
            track.gain
            * channel_gain
            * _automation_value(lanes, track.id, "gain", event.start_beat, 1)
        )
        pan = max(
            -1,
            min(
                1,
                track.pan
                + channel_pan
                + event.pan
                + _automation_value(lanes, track.id, "pan", event.start_beat, 0),
            ),
        )
        _render_event(
            stems[event.track_id],
            replace(event, start_beat=event.start_beat - start_beat),
            composition,
            gain,
            pan,
            lanes,
            cancelled,
        )
        if progress:
            progress(15 + round(index * 60 / max(len(events), 1)))
    stem_paths: dict[str, Path] = {}
    for track_id, stem_channels in stems.items():
        if cancelled and cancelled():
            raise RenderCancelled("render cancelled")
        path = destination / f"stem-{track_id}.wav"
        write_wav(
            path,
            stem_channels,
            composition.sample_rate,
            composition.render_settings.format,
        )
        stem_paths[str(track_id)] = path
    if progress:
        progress(85)
    mix = np.zeros((frame_count, 2), dtype=np.float64)
    master_gain = float(composition.mixer.get("master_gain", 1))
    for stem in stems.values():
        mix += stem
    for effect in composition.mixer.get("effects", []):
        if effect.get("kind") != "reverb":
            continue
        send_ids = _effect_track_ids(effect, tracks)
        bus = np.zeros_like(mix)
        for track_id in send_ids:
            bus += stems[track_id]
        taps = effect.get("taps", [])
        if taps:
            mix += reverb(bus, composition.sample_rate, taps)
    mix = np.tanh(mix * master_gain)
    limiter = composition.mixer.get("limiter", {})
    fade = min(
        round(float(limiter.get("fade_seconds", 0)) * composition.sample_rate),
        frame_count // 2,
    )
    if fade:
        mix[:fade] *= np.linspace(0, 1, fade)[:, None]
        mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    target_peak = float(limiter.get("normalization_peak", 0))
    peak = float(np.max(np.abs(mix))) if len(mix) else 0
    if peak and target_peak:
        mix *= target_peak / peak
    mix_path = destination / "mix.wav"
    write_wav(
        mix_path,
        mix,
        composition.sample_rate,
        composition.render_settings.format,
    )
    if progress:
        progress(95)
    return RenderedComposition(
        mix_path=mix_path, stem_paths=stem_paths, frame_count=frame_count
    )


def _automation_value(
    lanes: dict[str, AutomationLane],
    track_id: UUID,
    parameter: str,
    beat: float,
    default: float,
) -> float:
    lane = lanes.get(f"track.{track_id}.{parameter}")
    return default if lane is None else evaluate_automation(lane, beat)


def _render_event(
    channels: Audio,
    event: ScheduledCompositionEvent,
    composition: Composition,
    gain: float,
    pan: float,
    lanes: dict[str, AutomationLane],
    cancelled: Callable[[], bool] | None = None,
) -> None:
    start = beats_to_samples(
        event.start_beat, composition.tempo_bpm, composition.sample_rate
    )
    track = next(track for track in composition.tracks if track.id == event.track_id)
    parameters = track.instrument.parameters
    automated_ratio = _automation_value(
        lanes, track.id, "parameter.frequency_ratio", event.start_beat, 1
    )
    if automated_ratio != 1:
        parameters = {
            **parameters,
            "frequency_ratio": float(parameters.get("frequency_ratio", 1))
            * automated_ratio,
        }
    seed_offset = round(event.start_beat * 2)
    if event.track_kind == "drums" and event.midi_note == 42:
        seed_offset += 1000
    voice = synthesize(
        track_kind=event.track_kind,
        midi_note=event.midi_note,
        duration_seconds=event.duration_beats * 60 / composition.tempo_bpm,
        amplitude=event.velocity * gain,
        parameters=parameters,
        sample_rate=composition.sample_rate,
        seed=composition.seed + seed_offset,
    )
    if cancelled and cancelled():
        raise RenderCancelled("render cancelled")
    add(channels, stereo(voice, pan), start)


def _effect_track_ids(
    effect: dict[str, Any],
    tracks: dict[UUID, Track],
) -> set[UUID]:
    requested: set[UUID] = set()
    for value in effect.get("send_tracks", []):
        try:
            requested.add(UUID(str(value)))
        except ValueError:
            continue
    available = requested & tracks.keys()
    if available or not requested:
        return available
    return {
        track_id
        for track_id, track in tracks.items()
        if track.kind in {"pad", "arp", "lead"}
    }


def copy_composition(source: Composition) -> Composition:
    composition_id = uuid4()
    track_ids = {track.id: uuid4() for track in source.tracks}
    pattern_ids = {pattern.id: uuid4() for pattern in source.patterns}
    channel_ids = {channel.id: uuid4() for channel in source.mixer_channels}
    tracks = [
        track.model_copy(
            update={
                "id": track_ids[track.id],
                "processors": [_copy_effect(effect) for effect in track.processors],
            },
            deep=True,
        )
        for track in source.tracks
    ]
    patterns = [
        pattern.model_copy(
            update={
                "id": pattern_ids[pattern.id],
                "track_id": track_ids[pattern.track_id],
            },
            deep=True,
        )
        for pattern in source.patterns
    ]
    clips = [
        clip.model_copy(
            update={"id": uuid4(), "pattern_id": pattern_ids[clip.pattern_id]},
            deep=True,
        )
        for clip in source.clips
    ]
    channels = [
        channel.model_copy(
            update={
                "id": channel_ids[channel.id],
                "track_id": track_ids[channel.track_id] if channel.track_id else None,
                "output": channel_ids[channel.output]
                if isinstance(channel.output, UUID)
                else channel.output,
                "sends": {
                    channel_ids[target]: value
                    for target, value in channel.sends.items()
                },
                "effects": [_copy_effect(effect) for effect in channel.effects],
            },
            deep=True,
        )
        for channel in source.mixer_channels
    ]
    lanes = [
        lane.model_copy(
            update={"id": uuid4(), "target": _remap_target(lane.target, track_ids)},
            deep=True,
        )
        for lane in source.automation_lanes
    ]
    return source.model_copy(
        update={
            "id": composition_id,
            "revision": 0,
            "tracks": tracks,
            "patterns": patterns,
            "clips": clips,
            "mixer_channels": channels,
            "automation_lanes": lanes,
            "mixer": _remap_mixer(source.mixer, track_ids),
        },
        deep=True,
    )


def _copy_effect(effect: EffectInstance) -> EffectInstance:
    return effect.model_copy(update={"id": uuid4()}, deep=True)


def _remap_target(target: str, track_ids: dict[UUID, UUID]) -> str:
    scope, identifier, parameter = target.split(".", 2)
    if scope == "track":
        return f"track.{track_ids[UUID(identifier)]}.{parameter}"
    return target


def _remap_mixer(value: Any, track_ids: dict[UUID, UUID]) -> Any:
    if isinstance(value, dict):
        return {
            key: _remap_mixer(item, track_ids)
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_remap_mixer(item, track_ids) for item in value]
    if isinstance(value, str):
        try:
            identifier = UUID(value)
        except ValueError:
            return value
        return str(track_ids.get(identifier, identifier))
    return value
