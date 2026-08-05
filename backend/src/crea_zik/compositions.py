from __future__ import annotations

import hashlib
from collections.abc import Callable, Collection
from dataclasses import dataclass, replace
from itertools import pairwise
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

import numpy as np

from .composition_dsp import Audio, add, reverb, stereo, synthesize, write_wav
from .engine import RenderCancelled
from .models import (
    AutomationLane,
    Clip,
    Composition,
    EffectInstance,
    MixerChannel,
    NoteEvent,
    Pattern,
    Track,
)


@dataclass(frozen=True)
class ScheduledCompositionEvent:
    track_id: UUID
    track_kind: str
    start_beat: float
    duration_beats: float
    midi_note: int
    velocity: float
    pan: float
    probability: float = 1
    micro_timing_beats: float = 0


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
            scheduled.extend(_schedule_clip(pattern, occurrence, track))
    return sorted(
        scheduled,
        key=lambda event: (event.start_beat, str(event.track_id), event.midi_note),
    )


def _schedule_clip(
    pattern: Pattern, clip: Clip, track: Track
) -> list[ScheduledCompositionEvent]:
    end = clip.start_beat + clip.length_beats
    events = [_event(track, clip, note) for note in pattern.events]
    return [event for event in events if clip.start_beat <= event.start_beat < end]


def _event(track: Track, clip: Clip, note: NoteEvent) -> ScheduledCompositionEvent:
    return ScheduledCompositionEvent(
        track_id=track.id,
        track_kind=track.kind,
        start_beat=clip.start_beat + note.start_beat,
        duration_beats=note.duration_beats,
        midi_note=max(0, min(127, note.midi_note + clip.transposition)),
        velocity=max(0, min(1, note.velocity)),
        pan=max(-1, min(1, note.pan)),
        probability=max(0, min(1, note.probability)),
        micro_timing_beats=max(-1, min(1, note.micro_timing_beats)),
    )


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
        if channel and channel.mute:
            continue
        if soloed and not (channel and channel.solo):
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
    master = composition.master_channel
    master_gain = master.gain
    for stem in stems.values():
        mix += stem
    for effect in master.effects:
        if effect.bypass or effect.kind != "reverb":
            continue
        send_ids = _effect_track_ids(effect.parameters, tracks)
        bus = np.zeros_like(mix)
        for track_id in send_ids:
            bus += stems[track_id]
        taps = effect.parameters.get("taps", [])
        if taps:
            mix += reverb(bus, composition.sample_rate, taps)
    mix = np.tanh(mix * master_gain)
    limiter = next(
        (effect for effect in master.effects if effect.kind == "limiter" and not effect.bypass),
        None,
    )
    limiter_parameters = limiter.parameters if limiter else {}
    fade = min(
        round(float(limiter_parameters.get("fade_seconds", 0)) * composition.sample_rate),
        frame_count // 2,
    )
    if fade:
        mix[:fade] *= np.linspace(0, 1, fade)[:, None]
        mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    target_peak = float(limiter_parameters.get("normalization_peak", 0))
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


def _event_plays(event: ScheduledCompositionEvent, seed: int) -> bool:
    if event.probability >= 1:
        return True
    digest = hashlib.sha256(
        f"{seed}:{event.track_id}:{event.midi_note}:{event.start_beat}".encode()
    ).digest()
    return int.from_bytes(digest[:8], "big") / 2**64 < event.probability


def _render_event(
    channels: Audio,
    event: ScheduledCompositionEvent,
    composition: Composition,
    gain: float,
    pan: float,
    lanes: dict[str, AutomationLane],
    cancelled: Callable[[], bool] | None = None,
) -> None:
    if not _event_plays(event, composition.seed):
        return
    start = beats_to_samples(
        event.start_beat + event.micro_timing_beats,
        composition.tempo_bpm,
        composition.sample_rate,
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
    parameters: dict[str, Any],
    tracks: dict[UUID, Track],
) -> set[UUID]:
    requested: set[UUID] = set()
    for value in parameters.get("send_tracks", []):
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
            "master_channel": _copy_master_channel(source.master_channel, track_ids),
        },
        deep=True,
    )


def _copy_effect(effect: EffectInstance) -> EffectInstance:
    return effect.model_copy(update={"id": uuid4()}, deep=True)


def _copy_master_channel(
    channel: MixerChannel, track_ids: dict[UUID, UUID]
) -> MixerChannel:
    return channel.model_copy(
        update={
            "id": uuid4(),
            "effects": [
                effect.model_copy(
                    update={
                        "id": uuid4(),
                        "parameters": _remap_mixer(effect.parameters, track_ids),
                    },
                    deep=True,
                )
                for effect in channel.effects
            ],
        },
        deep=True,
    )


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
