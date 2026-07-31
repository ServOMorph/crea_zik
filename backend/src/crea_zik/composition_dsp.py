from __future__ import annotations

from math import cos, pi, sin
from pathlib import Path
from typing import Any
from wave import open as open_wave

import numpy as np
from numpy.typing import NDArray
from scipy import signal  # type: ignore[import-untyped]
from scipy.io import wavfile  # type: ignore[import-untyped]

from .plugins import render_plugin, resolve_params

Audio = NDArray[np.float64]


def envelope(
    length: int,
    sample_rate: int,
    parameters: dict[str, Any],
) -> Audio:
    if length <= 1:
        return np.zeros(length, dtype=np.float64)
    attack = float(parameters.get("attack", 0.01))
    decay = float(parameters.get("decay", 0.1))
    sustain = float(parameters.get("sustain", 0.7))
    release = float(parameters.get("release", 0.1))
    attack_n = min(int(attack * sample_rate), length)
    release_n = min(int(release * sample_rate), max(0, length - attack_n))
    body_n = length - attack_n - release_n
    decay_n = min(int(decay * sample_rate), body_n)
    sustain_n = body_n - decay_n
    parts: list[Audio] = []
    if attack_n:
        parts.append(np.linspace(0, 1, attack_n, endpoint=False))
    if decay_n:
        parts.append(np.linspace(1, sustain, decay_n, endpoint=False))
    if sustain_n:
        parts.append(np.full(sustain_n, sustain))
    if release_n:
        parts.append(
            np.linspace(sustain if body_n else 1, 0, release_n, endpoint=True)
        )
    result = np.concatenate(parts) if parts else np.zeros(length)
    return np.pad(result, (0, max(0, length - len(result))))[:length]


def stereo(mono: Audio, pan: float) -> Audio:
    angle = (float(np.clip(pan, -1, 1)) + 1) * pi / 4
    return np.column_stack((mono * cos(angle), mono * sin(angle)))


def add(buffer: Audio, voice: Audio, start: int) -> None:
    if start >= len(buffer) or start + len(voice) <= 0:
        return
    source_start = max(0, -start)
    destination = max(0, start)
    end = min(len(buffer), start + len(voice))
    buffer[destination:end] += voice[
        source_start : source_start + end - destination
    ]


def synthesize(
    *,
    track_kind: str,
    midi_note: int,
    duration_seconds: float,
    amplitude: float,
    parameters: dict[str, Any],
    sample_rate: int,
    seed: int,
) -> Audio:
    if track_kind == "drums":
        if midi_note == 39:
            return _clap(sample_rate, seed, amplitude, parameters.get("clap", {}))
        if midi_note == 42:
            return _hat(sample_rate, seed, amplitude, parameters.get("hat", {}))
        plugin_id = parameters.get("plugin_id")
        if plugin_id:
            return _plugin_voice(plugin_id, parameters, amplitude, sample_rate, seed)
        return _kick(
            sample_rate,
            max(duration_seconds, 0.46),
            amplitude,
            parameters.get("kick", {}),
        )
    length = max(1, round(duration_seconds * sample_rate))
    time = np.arange(length, dtype=np.float64) / sample_rate
    frequency_ratio = float(parameters.get("frequency_ratio", 1))
    frequency = 440 * 2 ** ((midi_note - 69) / 12) * frequency_ratio
    oscillator_parameters = parameters.get("oscillators", [{"ratio": 1, "gain": 1}])
    oscillators = (
        oscillator_parameters
        if isinstance(oscillator_parameters, list)
        else [{"ratio": 1, "gain": 1}]
    )
    if track_kind == "pad":
        tone = _pad(time, frequency, oscillators)
    elif track_kind == "lead":
        tone = _lead(time, frequency, oscillators, parameters)
    else:
        tone = _harmonics(time, frequency, oscillators)
    if track_kind == "arp":
        tone *= np.exp(-time * float(parameters.get("decay", 4.5)))
    lowpass = parameters.get("lowpass_hz")
    if lowpass is not None:
        tone = _filter(tone, sample_rate, float(lowpass), "lowpass")
    shaped = tone * envelope(
        length,
        sample_rate,
        parameters.get("envelope", {}),
    )
    return shaped * amplitude


def _harmonics(
    time: Audio,
    frequency: float,
    oscillators: list[dict[str, Any]],
) -> Audio:
    tone = np.zeros(len(time), dtype=np.float64)
    for oscillator in oscillators:
        ratio = float(oscillator.get("ratio", 1))
        gain = float(oscillator.get("gain", 1))
        tone += gain * np.sin(2 * pi * frequency * ratio * time)
    return tone


def _pad(
    time: Audio,
    frequency: float,
    oscillators: list[dict[str, Any]],
) -> Audio:
    tone = np.zeros(len(time), dtype=np.float64)
    for oscillator in oscillators:
        gain = float(oscillator.get("gain", 1))
        if "detune_semitones" in oscillator:
            ratio = 1 + float(oscillator["detune_semitones"])
        else:
            ratio = float(oscillator.get("ratio", 1))
        tone += gain * np.sin(2 * pi * frequency * ratio * time)
    return tone


def _lead(
    time: Audio,
    frequency: float,
    oscillators: list[dict[str, Any]],
    parameters: dict[str, Any],
) -> Audio:
    vibrato = parameters.get("vibrato", {})
    depth = float(vibrato.get("depth_semitones", 0))
    rate = float(vibrato.get("rate_hz", 0))
    modulation = depth * np.sin(2 * pi * rate * time)
    phase = 2 * pi * frequency * time * (1 + modulation)
    tone = np.zeros(len(time), dtype=np.float64)
    for oscillator in oscillators:
        ratio = float(oscillator.get("ratio", 1))
        gain = float(oscillator.get("gain", 1))
        tone += gain * np.sin(phase * ratio)
    return tone


def _kick(
    sample_rate: int,
    duration: float,
    amplitude: float,
    parameters: dict[str, Any],
) -> Audio:
    count = max(1, round(duration * sample_rate))
    time = np.arange(count, dtype=np.float64) / sample_rate
    frequency = parameters.get("frequency_hz", {})
    base = float(frequency.get("base", 47))
    drop = float(frequency.get("drop", 112))
    sweep_decay = float(frequency.get("decay", 30))
    phase = 2 * pi * np.cumsum(base + drop * np.exp(-time * sweep_decay))
    phase /= sample_rate
    body = np.sin(phase) * np.exp(
        -time * float(parameters.get("body_decay", 9.5))
    )
    click = (
        np.sin(2 * pi * float(parameters.get("click_hz", 1900)) * time)
        * np.exp(-time * float(parameters.get("click_decay", 65)))
        * float(parameters.get("click_gain", 0.09))
    )
    return (body + click) * amplitude


def _plugin_voice(
    plugin_id: str,
    parameters: dict[str, Any],
    amplitude: float,
    sample_rate: int,
    seed: int,
) -> Audio:
    preset = str(parameters.get("plugin_preset", "techno"))
    overrides = dict(parameters.get("plugin_overrides", {}))
    overrides.setdefault("seed", seed)
    params = resolve_params(plugin_id, preset, overrides)
    audio, engine_sample_rate = render_plugin(plugin_id, params, velocity=1.0)
    if engine_sample_rate != sample_rate:
        raise ValueError(
            f"plugin {plugin_id} sample rate {engine_sample_rate} does not match "
            f"composition sample rate {sample_rate}"
        )
    return np.asarray(audio).mean(axis=1) * amplitude


def _clap(
    sample_rate: int,
    seed: int,
    amplitude: float,
    parameters: dict[str, Any],
) -> Audio:
    duration = float(parameters.get("duration_seconds", 0.22))
    count = max(1, round(duration * sample_rate))
    time = np.arange(count, dtype=np.float64) / sample_rate
    noise = np.random.default_rng(seed).standard_normal(count)
    bandpass = parameters.get("bandpass_hz", [850, 9000])
    filtered = _bandpass(noise, sample_rate, float(bandpass[0]), float(bandpass[1]))
    width = float(parameters.get("burst_width_seconds", 0.011))
    bursts = sum(
        (
            np.exp(-((time - float(position)) / width) ** 2)
            for position in parameters.get("bursts_seconds", [0, 0.018, 0.036])
        ),
        start=np.zeros(count),
    )
    return (
        filtered
        * bursts
        * np.exp(-time * float(parameters.get("decay", 7)))
        * amplitude
    )


def _hat(
    sample_rate: int,
    seed: int,
    amplitude: float,
    parameters: dict[str, Any],
) -> Audio:
    duration = float(parameters.get("duration_seconds", 0.085))
    count = max(1, round(duration * sample_rate))
    time = np.arange(count, dtype=np.float64) / sample_rate
    noise = np.random.default_rng(seed).standard_normal(count)
    highpass = float(parameters.get("highpass_hz", 6800))
    return (
        _filter(noise, sample_rate, highpass, "highpass")
        * np.exp(-time * float(parameters.get("decay", 52)))
        * amplitude
    )


def _filter(audio: Audio, sample_rate: int, cutoff: float, kind: str) -> Audio:
    nyquist = sample_rate / 2
    normalized = min(max(cutoff, 20), nyquist * 0.99)
    sos = signal.butter(2, normalized, btype=kind, fs=sample_rate, output="sos")
    return signal.sosfilt(sos, audio)


def _bandpass(
    audio: Audio,
    sample_rate: int,
    low: float,
    high: float,
) -> Audio:
    nyquist = sample_rate / 2
    bounds = [max(20, low), min(high, nyquist * 0.99)]
    sos = signal.butter(2, bounds, btype="bandpass", fs=sample_rate, output="sos")
    return signal.sosfilt(sos, audio)


def reverb(audio: Audio, sample_rate: int, taps: list[list[float]]) -> Audio:
    wet = np.zeros_like(audio)
    for seconds, gain, pan in taps:
        delay = round(float(seconds) * sample_rate)
        if delay <= 0 or delay >= len(audio):
            continue
        source = audio[:-delay]
        wet[delay:, 0] += source[:, 0] * float(gain) * (1 - float(pan))
        wet[delay:, 1] += source[:, 1] * float(gain) * (1 + float(pan))
    return wet


def write_wav(
    path: Path,
    audio: Audio,
    sample_rate: int,
    audio_format: str,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if audio_format == "wav_float32":
        wavfile.write(path, sample_rate, np.asarray(audio, dtype=np.float32))
        return
    if audio_format == "wav_pcm24":
        pcm = np.rint(np.clip(audio, -1, 1) * 8_388_607).astype(np.int32).reshape(-1)
        packed = np.empty((len(pcm), 3), dtype=np.uint8)
        packed[:, 0] = pcm & 0xFF
        packed[:, 1] = (pcm >> 8) & 0xFF
        packed[:, 2] = (pcm >> 16) & 0xFF
        sample_width = 3
        frames = packed.tobytes()
    else:
        sample_width = 2
        frames = (
            np.rint(np.clip(audio, -1, 1) * 32_767)
            .astype("<i2")
            .reshape(-1)
            .tobytes()
        )
    with open_wave(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(sample_width)
        output.setframerate(sample_rate)
        output.writeframes(frames)
