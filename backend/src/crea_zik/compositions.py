from __future__ import annotations

import hashlib
from collections.abc import Callable, Collection
from dataclasses import dataclass, replace
from itertools import pairwise
from pathlib import Path
from typing import Any, Literal
from uuid import UUID, uuid4

import numpy as np
from numpy.typing import NDArray

from .composition_dsp import (
    Audio,
    add,
    apply_balance_pan,
    compress,
    delay_line,
    eq_band,
    reverb,
    saturate,
    stereo,
    stereo_envelope,
    synthesize,
    write_wav,
)
from .effect_registry import sanitize_effect_parameters
from .engine import RenderCancelled
from .instrument_registry import set_parameter_path
from .models import (
    AutomationLane,
    AutomationPoint,
    Clip,
    Composition,
    EffectInstance,
    MixerChannel,
    NoteEvent,
    Pattern,
    Track,
)

_BUS_ONLY_EFFECT_KINDS = frozenset({"reverb", "limiter"})


def _apply_effect_chain(
    buffer: Audio,
    effects: list[EffectInstance],
    sample_rate: int,
    *,
    skip_kinds: frozenset[str] = _BUS_ONLY_EFFECT_KINDS,
) -> Audio:
    result = buffer
    for effect in effects:
        if effect.bypass or effect.kind in skip_kinds:
            continue
        parameters = sanitize_effect_parameters(effect.kind, effect.parameters)
        if effect.kind == "eq":
            result = eq_band(
                result,
                sample_rate,
                parameters["freq_hz"],
                parameters["gain_db"],
                parameters["q"],
            )
        elif effect.kind == "saturation":
            result = saturate(result, parameters["drive"], parameters["mix"])
        elif effect.kind == "compressor":
            result = compress(
                result,
                sample_rate,
                parameters["threshold_db"],
                parameters["ratio"],
                parameters["attack_ms"],
                parameters["release_ms"],
            )
        elif effect.kind == "delay":
            result = delay_line(
                result,
                sample_rate,
                parameters["time_seconds"],
                parameters["feedback"],
                parameters["mix"],
            )
    return result


def _topological_channel_order(channels: dict[UUID, MixerChannel]) -> list[UUID]:
    in_degree: dict[UUID, int] = dict.fromkeys(channels, 0)
    edges: dict[UUID, list[UUID]] = {channel_id: [] for channel_id in channels}
    for channel_id, channel in channels.items():
        targets = [target for target in channel.sends if target in channels]
        if isinstance(channel.output, UUID) and channel.output in channels:
            targets.append(channel.output)
        for target in targets:
            edges[channel_id].append(target)
            in_degree[target] += 1
    queue = [channel_id for channel_id, degree in in_degree.items() if degree == 0]
    order: list[UUID] = []
    while queue:
        current = queue.pop()
        order.append(current)
        for target in edges[current]:
            in_degree[target] -= 1
            if in_degree[target] == 0:
                queue.append(target)
    return order


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


def composition_end_beat(composition: Composition) -> float:
    return max(
        (
            clip.start_beat + clip.length_beats * clip.repeat_count
            for clip in composition.clips
        ),
        default=0,
    )


def schedule_composition(composition: Composition) -> list[ScheduledCompositionEvent]:
    patterns = {pattern.id: pattern for pattern in composition.patterns}
    tracks = {track.id: track for track in composition.tracks}
    scheduled: list[ScheduledCompositionEvent] = []
    for clip in composition.clips:
        if clip.mute:
            continue
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
    for point in points:
        if beat == point.beat:
            return point.value
    if beat < points[0].beat:
        return points[0].value
    for left, right in pairwise(points):
        if beat < right.beat:
            progress = (beat - left.beat) / (right.beat - left.beat)
            if left.interpolation == "step":
                return left.value
            if left.interpolation == "smooth":
                progress = progress * progress * (3 - 2 * progress)
            return left.value + (right.value - left.value) * progress
    return points[-1].value


def evaluate_automation_values(
    lane: AutomationLane, beats: NDArray[np.float64]
) -> NDArray[np.float64]:
    points = lane.points
    count = len(points)
    if count == 1:
        return np.full(beats.shape, points[0].value, dtype=np.float64)
    left_beats = np.array([point.beat for point in points], dtype=np.float64)
    values = np.array([point.value for point in points], dtype=np.float64)
    result = np.empty(beats.shape, dtype=np.float64)
    result[beats <= left_beats[0]] = values[0]
    result[beats >= left_beats[-1]] = values[-1]
    interior = (beats > left_beats[0]) & (beats < left_beats[-1])
    if not interior.any():
        return result
    segment = beats[interior]
    right_index = np.searchsorted(left_beats, segment, side="right")
    right_index = np.clip(right_index, 1, count - 1)
    left_index = right_index - 1
    span = left_beats[right_index] - left_beats[left_index]
    progress = (segment - left_beats[left_index]) / span
    linear = progress
    for index in range(count - 1):
        if points[index].interpolation == "smooth":
            mask = left_index == index
            linear[mask] = progress[mask] * progress[mask] * (3 - 2 * progress[mask])
        elif points[index].interpolation == "step":
            mask = left_index == index
            linear[mask] = 0
    result[interior] = values[left_index] + (values[right_index] - values[left_index]) * linear
    return result


def render_composition(
    composition: Composition,
    destination: Path,
    *,
    track_ids: Collection[UUID] | None = None,
    start_beat: float = 0,
    end_beat: float | None = None,
    cancelled: Callable[[], bool] | None = None,
    progress: Callable[[int], None] | None = None,
    loop: bool = False,
    clip_ids: Collection[UUID] | None = None,
) -> RenderedComposition:
    if clip_ids is not None:
        selected_clip_ids = set(clip_ids)
        selected_clips = [c for c in composition.clips if c.id in selected_clip_ids]
        composition = composition.model_copy(update={"clips": selected_clips})
        if selected_clips:
            if start_beat == 0 and end_beat is None:
                start_beat = min(c.start_beat for c in selected_clips)
                end_beat = max(c.start_beat + c.length_beats * c.repeat_count for c in selected_clips)
        else:
            if start_beat == 0 and end_beat is None:
                start_beat = 0
                end_beat = 0.25

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
    active_events: list[ScheduledCompositionEvent] = []
    for index, event in enumerate(events, start=1):
        if cancelled and cancelled():
            raise RenderCancelled("render cancelled")
        channel = channels.get(event.track_id)
        if channel and channel.mute:
            continue
        if soloed and not (channel and channel.solo):
            continue
        active_events.append(event)
        channel_gain = channel.gain if channel else 1
        channel_pan = channel.pan if channel else 0
        _render_event(
            stems[event.track_id],
            replace(event, start_beat=event.start_beat - start_beat),
            composition,
            channel_gain,
            channel_pan,
            lanes,
            event.start_beat,
            cancelled,
        )
        if progress:
            progress(15 + round(index * 60 / max(len(events), 1)))
    channels_by_id = {channel.id: channel for channel in composition.mixer_channels}
    processed_stems = {
        track_id: _apply_effect_chain(
            buffer, channels[track_id].effects, composition.sample_rate
        )
        if track_id in channels
        else buffer
        for track_id, buffer in stems.items()
    }
    if composition.render_settings.stem_fader == "pre":
        dry_stems = {
            track_id: np.zeros((frame_count, 2), dtype=np.float64)
            for track_id in tracks
        }
        for event in active_events:
            if cancelled and cancelled():
                raise RenderCancelled("render cancelled")
            _render_event(
                dry_stems[event.track_id],
                replace(event, start_beat=event.start_beat - start_beat),
                composition,
                1,
                0,
                lanes,
                event.start_beat,
                cancelled,
            )
        export_stems = dry_stems
    else:
        export_stems = processed_stems
    stem_paths: dict[str, Path] = {}
    for track_id, stem_channels in export_stems.items():
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
    channel_input = {
        channel_id: np.zeros((frame_count, 2), dtype=np.float64)
        for channel_id in channels_by_id
    }
    for channel in channels_by_id.values():
        if channel.track_id is not None and channel.track_id in processed_stems:
            channel_input[channel.id] = channel_input[channel.id] + processed_stems[channel.track_id]
    resolved_channel_output: dict[UUID, Audio] = {}
    for channel_id in _topological_channel_order(channels_by_id):
        channel = channels_by_id[channel_id]
        buffer = channel_input[channel_id]
        for target_id, amount in channel.sends.items():
            if target_id in channel_input:
                channel_input[target_id] = channel_input[target_id] + buffer * amount
        if channel.track_id is None:
            buffer = _apply_effect_chain(buffer, channel.effects, composition.sample_rate)
            buffer = buffer * channel.gain
            buffer = apply_balance_pan(buffer, channel.pan)
        if isinstance(channel.output, UUID) and channel.output in channel_input:
            channel_input[channel.output] = channel_input[channel.output] + buffer
        else:
            resolved_channel_output[channel_id] = buffer
    # Sommation en ordre de déclaration (pistes puis bus), pas en ordre de traitement
    # topologique, pour préserver l'ordre de sommation flottante des rendus existants
    # quand aucun routage n'est en jeu (bit-exactitude des golden non affectée).
    master_bus_input = np.zeros((frame_count, 2), dtype=np.float64)
    for track in composition.tracks:
        if track.id not in processed_stems:
            continue
        channel = channels.get(track.id)
        if channel is None:
            master_bus_input += processed_stems[track.id]
        elif channel.id in resolved_channel_output:
            master_bus_input += resolved_channel_output[channel.id]
    for mixer_channel in composition.mixer_channels:
        if mixer_channel.track_id is None and mixer_channel.id in resolved_channel_output:
            master_bus_input += resolved_channel_output[mixer_channel.id]
    mix = master_bus_input
    master = composition.master_channel
    master_gain = master.gain
    for effect in master.effects:
        if effect.bypass or effect.kind != "reverb":
            continue
        send_ids = _effect_track_ids(effect.parameters, tracks)
        bus = np.zeros_like(mix)
        for track_id in send_ids:
            bus += processed_stems[track_id]
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


def _render_event(
    channels: Audio,
    event: ScheduledCompositionEvent,
    composition: Composition,
    channel_gain: float,
    channel_pan: float,
    lanes: dict[str, AutomationLane],
    absolute_start_beat: float,
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
    parameters = _automated_parameters(track, absolute_start_beat, lanes)
    gain_lane = lanes.get(f"track.{event.track_id}.gain")
    pan_lane = lanes.get(f"track.{event.track_id}.pan")
    seed_offset = round(absolute_start_beat * 2)
    if event.track_kind == "drums" and event.midi_note == 42:
        seed_offset += 1000
    if gain_lane is None and pan_lane is None:
        gain = track.gain * channel_gain
        pan = max(-1, min(1, track.pan + channel_pan + event.pan))
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
        return
    voice = synthesize(
        track_kind=event.track_kind,
        midi_note=event.midi_note,
        duration_seconds=event.duration_beats * 60 / composition.tempo_bpm,
        amplitude=event.velocity * channel_gain,
        parameters=parameters,
        sample_rate=composition.sample_rate,
        seed=composition.seed + seed_offset,
    )
    if cancelled and cancelled():
        raise RenderCancelled("render cancelled")
    samples = len(voice)
    beats = absolute_start_beat + (
        np.arange(samples, dtype=np.float64)
        / composition.sample_rate
        * composition.tempo_bpm
        / 60
    )
    if gain_lane is None:
        gain_envelope = np.full(samples, track.gain, dtype=np.float64)
    else:
        gain_envelope = evaluate_automation_values(gain_lane, beats)
    if pan_lane is None:
        pan_envelope = np.full(
            samples,
            max(-1, min(1, track.pan + channel_pan + event.pan)),
            dtype=np.float64,
        )
    else:
        pan_envelope = evaluate_automation_values(pan_lane, beats) + channel_pan + event.pan
    add(channels, stereo_envelope(voice * gain_envelope, pan_envelope), start)


def _automated_parameters(
    track: Track,
    beat: float,
    lanes: dict[str, AutomationLane],
) -> dict[str, Any]:
    parameters = dict(track.instrument.parameters)
    prefix = f"track.{track.id}.parameter."
    for target, lane in lanes.items():
        if not target.startswith(prefix):
            continue
        path = target[len(prefix) :]
        value = evaluate_automation(lane, beat)
        _, updated = set_parameter_path(track.kind, parameters, path, value)
        if updated is not parameters:
            parameters = updated
            continue
        _write_parameter_path(parameters, path, value)
    return parameters


def _write_parameter_path(parameters: dict[str, Any], path: str, value: float) -> None:
    pieces = path.split(".")
    current: Any = parameters
    for index, piece in enumerate(pieces):
        last = index == len(pieces) - 1
        if last:
            current[piece] = value
        else:
            current = current.setdefault(piece, {})


def _event_plays(event: ScheduledCompositionEvent, seed: int) -> bool:
    if event.probability >= 1:
        return True
    digest = hashlib.sha256(
        f"{seed}:{event.track_id}:{event.midi_note}:{event.start_beat}".encode()
    ).digest()
    return int.from_bytes(digest[:8], "big") / 2**64 < event.probability


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
    markers = [
        marker.model_copy(update={"id": uuid4()}) for marker in source.markers
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
            "markers": markers,
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


DEMO_AUTOMATION_PATTERNS: dict[
    str, tuple[tuple[float, float, Literal["step", "linear", "smooth"]], ...]
] = {
    "gain": ((0.0, 0.9, "smooth"), (0.5, 1.15, "smooth"), (1.0, 0.9, "smooth")),
    "pan": ((0.0, -0.3, "linear"), (1.0, 0.3, "linear")),
    "lowpass_hz": (
        (0.0, 1200.0, "smooth"),
        (0.5, 3600.0, "smooth"),
        (1.0, 1200.0, "smooth"),
    ),
}


def _demo_points(
    end_beat: float,
    pattern: tuple[tuple[float, float, Literal["step", "linear", "smooth"]], ...],
) -> list[AutomationPoint]:
    return [
        AutomationPoint(beat=end_beat * fraction, value=value, interpolation=kind)
        for fraction, value, kind in pattern
    ]


def with_demo_automations(composition: Composition) -> Composition:
    """Ajoute des lanes d'automation démonstratives à une copie éditable.

    La référence de galerie reste immuable : cette fonction n'est appelée que sur
    les copies créées depuis la galerie (create_composition et
    copy_composition_gallery_example).
    """
    end_beat = composition_end_beat(composition) or 16
    lanes = list(composition.automation_lanes)
    existing = {lane.target for lane in lanes}
    for index, track in enumerate(composition.tracks):
        kind = track.kind
        if kind not in {"pad", "arp", "lead"}:
            continue
        pan_target = f"track.{track.id}.pan"
        if pan_target not in existing:
            lanes.append(
                AutomationLane(
                    target=pan_target,
                    points=_demo_points(end_beat, DEMO_AUTOMATION_PATTERNS["pan"]),
                )
            )
        if kind == "lead":
            gain_target = f"track.{track.id}.gain"
            if gain_target not in existing:
                lanes.append(
                    AutomationLane(
                        target=gain_target,
                        points=_demo_points(
                            end_beat, DEMO_AUTOMATION_PATTERNS["gain"]
                        ),
                    )
                )
        if kind == "pad":
            filter_target = f"track.{track.id}.parameter.lowpass_hz"
            if filter_target not in existing:
                lanes.append(
                    AutomationLane(
                        target=filter_target,
                        points=_demo_points(
                            end_beat, DEMO_AUTOMATION_PATTERNS["lowpass_hz"]
                        ),
                    )
                )
    return composition.model_copy(update={"automation_lanes": lanes}, deep=True)
