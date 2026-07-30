from __future__ import annotations

import argparse
import hashlib
import json
import math
import wave
from pathlib import Path
from typing import Any

import numpy as np
from scipy import signal


ROOT = Path(__file__).resolve().parent


def load_spec(path: Path) -> dict[str, Any]:
    spec = json.loads(path.read_text(encoding="utf-8"))
    required = {"schema_version", "title", "seed", "sample_rate", "duration_seconds", "tempo_bpm", "tracks", "harmony_midi"}
    missing = required.difference(spec)
    if missing:
        raise ValueError(f"Champs manquants: {', '.join(sorted(missing))}")
    if spec["schema_version"] != 1:
        raise ValueError("Version de schema non prise en charge")
    if spec["sample_rate"] != 48_000:
        raise ValueError("Le prototype travaille uniquement a 48 kHz")
    if spec["duration_seconds"] <= 0 or spec["tempo_bpm"] <= 0:
        raise ValueError("Duree et tempo doivent etre strictement positifs")
    return spec


def midi_to_hz(note: int) -> float:
    return 440.0 * 2.0 ** ((note - 69) / 12.0)


def dbfs(value: float) -> float:
    return 20.0 * math.log10(max(value, 1e-12))


def envelope(length: int, sample_rate: int, attack: float, decay: float, sustain: float, release: float) -> np.ndarray:
    if length <= 1:
        return np.zeros(length, dtype=np.float64)
    attack_n = min(int(attack * sample_rate), length)
    release_n = min(int(release * sample_rate), max(0, length - attack_n))
    body_n = length - attack_n - release_n
    decay_n = min(int(decay * sample_rate), body_n)
    sustain_n = body_n - decay_n
    parts: list[np.ndarray] = []
    if attack_n:
        parts.append(np.linspace(0.0, 1.0, attack_n, endpoint=False))
    if decay_n:
        parts.append(np.linspace(1.0, sustain, decay_n, endpoint=False))
    if sustain_n:
        parts.append(np.full(sustain_n, sustain))
    if release_n:
        start = sustain if body_n else 1.0
        parts.append(np.linspace(start, 0.0, release_n, endpoint=True))
    result = np.concatenate(parts) if parts else np.zeros(length)
    return np.pad(result, (0, max(0, length - len(result))))[:length]


def stereo(mono: np.ndarray, pan: float) -> np.ndarray:
    angle = (np.clip(pan, -1.0, 1.0) + 1.0) * math.pi / 4.0
    return np.column_stack((mono * math.cos(angle), mono * math.sin(angle)))


def add(buffer: np.ndarray, voice: np.ndarray, start: int) -> None:
    if start >= len(buffer) or start + len(voice) <= 0:
        return
    offset = max(0, -start)
    destination = max(0, start)
    end = min(len(buffer), start + len(voice))
    buffer[destination:end] += voice[offset : offset + end - destination]


def kick(sample_rate: int, duration: float, amplitude: float) -> np.ndarray:
    count = int(duration * sample_rate)
    time = np.arange(count) / sample_rate
    frequency = 47.0 + 112.0 * np.exp(-time * 30.0)
    phase = 2.0 * np.pi * np.cumsum(frequency) / sample_rate
    body = np.sin(phase) * np.exp(-time * 9.5)
    click = np.sin(2.0 * np.pi * 1900.0 * time) * np.exp(-time * 65.0) * 0.09
    return (body + click) * amplitude


def clap(sample_rate: int, seed: int, amplitude: float) -> np.ndarray:
    rng = np.random.default_rng(seed)
    count = int(0.22 * sample_rate)
    time = np.arange(count) / sample_rate
    noise = rng.standard_normal(count)
    sos = signal.butter(2, [850.0, 9000.0], btype="bandpass", fs=sample_rate, output="sos")
    filtered = signal.sosfilt(sos, noise)
    bursts = sum(np.exp(-((time - position) / 0.011) ** 2) for position in (0.0, 0.018, 0.036))
    return filtered * bursts * np.exp(-time * 7.0) * amplitude


def hat(sample_rate: int, seed: int, amplitude: float) -> np.ndarray:
    rng = np.random.default_rng(seed)
    count = int(0.085 * sample_rate)
    time = np.arange(count) / sample_rate
    noise = rng.standard_normal(count)
    sos = signal.butter(2, 6800.0, btype="highpass", fs=sample_rate, output="sos")
    return signal.sosfilt(sos, noise) * np.exp(-time * 52.0) * amplitude


def bass_voice(sample_rate: int, note: int, duration: float, amplitude: float) -> np.ndarray:
    count = int(duration * sample_rate)
    time = np.arange(count) / sample_rate
    frequency = midi_to_hz(note)
    phase = 2.0 * np.pi * frequency * time
    harmonic = np.sin(phase) + 0.33 * np.sin(2.0 * phase) + 0.12 * np.sin(3.0 * phase)
    tone = signal.sosfilt(signal.butter(2, 620.0, btype="lowpass", fs=sample_rate, output="sos"), harmonic)
    return tone * envelope(count, sample_rate, 0.008, 0.12, 0.72, 0.07) * amplitude


def pad_voice(sample_rate: int, notes: list[int], duration: float, amplitude: float) -> np.ndarray:
    count = int(duration * sample_rate)
    time = np.arange(count) / sample_rate
    voice = np.zeros(count)
    for note in notes:
        frequency = midi_to_hz(note)
        for detune, gain in ((-0.004, 0.18), (0.0, 0.30), (0.003, 0.18)):
            phase = 2.0 * np.pi * frequency * (1.0 + detune) * time
            voice += gain * (np.sin(phase) + 0.16 * np.sin(2.0 * phase))
    filtered = signal.sosfilt(signal.butter(2, 2400.0, btype="lowpass", fs=sample_rate, output="sos"), voice)
    return filtered * envelope(count, sample_rate, 0.65, 1.2, 0.70, 0.8) * amplitude


def pluck_voice(sample_rate: int, note: int, duration: float, amplitude: float) -> np.ndarray:
    count = int(duration * sample_rate)
    time = np.arange(count) / sample_rate
    frequency = midi_to_hz(note)
    phase = 2.0 * np.pi * frequency * time
    harmonics = np.sin(phase) + 0.34 * np.sin(2.0 * phase) + 0.14 * np.sin(3.0 * phase)
    return harmonics * np.exp(-time * 4.5) * envelope(count, sample_rate, 0.006, 0.11, 0.40, 0.22) * amplitude


def lead_voice(sample_rate: int, note: int, duration: float, amplitude: float) -> np.ndarray:
    count = int(duration * sample_rate)
    time = np.arange(count) / sample_rate
    frequency = midi_to_hz(note)
    vibrato = 0.004 * np.sin(2.0 * np.pi * 5.2 * time)
    phase = 2.0 * np.pi * frequency * time * (1.0 + vibrato)
    sound = np.sin(phase) + 0.23 * np.sin(2.0 * phase) + 0.07 * np.sin(3.0 * phase)
    return sound * envelope(count, sample_rate, 0.025, 0.18, 0.68, 0.20) * amplitude


def reverb(stereo_signal: np.ndarray, sample_rate: int) -> np.ndarray:
    wet = np.zeros_like(stereo_signal)
    delays = ((0.073, 0.28, -0.32), (0.113, 0.22, 0.25), (0.167, 0.17, -0.18), (0.241, 0.12, 0.16))
    for seconds, gain, pan in delays:
        delay = int(seconds * sample_rate)
        source = stereo_signal[:-delay]
        wet[delay:, 0] += source[:, 0] * gain * (1.0 - pan)
        wet[delay:, 1] += source[:, 1] * gain * (1.0 + pan)
    return wet


def render_audio(spec: dict[str, Any]) -> tuple[np.ndarray, dict[str, np.ndarray]]:
    sample_rate = int(spec["sample_rate"])
    duration = float(spec["duration_seconds"])
    tempo = float(spec["tempo_bpm"])
    total_samples = int(round(duration * sample_rate))
    seconds_per_beat = 60.0 / tempo
    beats_per_bar = int(spec["time_signature"][0])
    bars = int(math.ceil(duration / (seconds_per_beat * beats_per_bar)))
    harmony = list(spec["harmony_midi"])
    seed = int(spec["seed"])
    tracks = {track["id"]: np.zeros((total_samples, 2), dtype=np.float64) for track in spec["tracks"]}

    def beat_to_sample(beat: float) -> int:
        return int(round(beat * seconds_per_beat * sample_rate))

    drums = tracks["drums"]
    for beat in range(int(duration / seconds_per_beat)):
        bar = beat // beats_per_bar
        if bar >= 2:
            add(drums, stereo(kick(sample_rate, 0.46, 0.92 if bar >= 6 else 0.72), 0.0), beat_to_sample(beat))
        if bar >= 2 and beat % beats_per_bar in (1, 3):
            add(drums, stereo(clap(sample_rate, seed + beat, 0.23), 0.0), beat_to_sample(beat))
        if bar >= 4:
            for subdivision in (0.5, 1.5):
                start = beat_to_sample(beat + subdivision)
                pan = -0.28 if int((beat + subdivision) * 2) % 2 == 0 else 0.28
                add(drums, stereo(hat(sample_rate, seed + 1000 + int((beat + subdivision) * 2), 0.075), pan), start)

    bass = tracks["bass"]
    pad = tracks["pad"]
    arp = tracks["arp"]
    lead = tracks["lead"]
    chord_intervals = (0, 3, 7, 10)
    for bar in range(bars):
        root = harmony[bar % len(harmony)]
        bar_beat = bar * beats_per_bar
        bar_duration = beats_per_bar * seconds_per_beat
        if bar < 15:
            add(pad, stereo(pad_voice(sample_rate, [root + 12, root + 15, root + 19], bar_duration + 0.8, 0.12 if bar < 2 else 0.19), 0.0), beat_to_sample(bar_beat))
        if bar >= 4:
            for step in range(4):
                note = root if step in (0, 2) else root + 12
                add(bass, stereo(bass_voice(sample_rate, note, 0.42, 0.30), 0.0), beat_to_sample(bar_beat + step))
        if bar >= 6:
            notes = [root + interval + 12 for interval in chord_intervals]
            pattern = (0, 2, 1, 3, 2, 1, 0, 1)
            for index, choice in enumerate(pattern):
                pan = -0.42 if index % 2 == 0 else 0.42
                add(arp, stereo(pluck_voice(sample_rate, notes[choice], 0.42, 0.23), pan), beat_to_sample(bar_beat + index * 0.5))

    melody = ((10, 69), (10.75, 72), (11.5, 76), (12.5, 74), (13.0, 72), (13.75, 69), (14.5, 72), (15.0, 77), (15.75, 76), (16.5, 72), (17.0, 69), (18.0, 72), (19.0, 76), (20.0, 79), (21.0, 76), (22.0, 74), (23.0, 72), (24.0, 69), (25.0, 72), (26.0, 76), (27.0, 74))
    for beat, note in melody:
        if beat < duration / seconds_per_beat:
            add(lead, stereo(lead_voice(sample_rate, note, 0.56, 0.19), -0.12), beat_to_sample(beat))

    gains = {track["id"]: float(track["gain"]) for track in spec["tracks"]}
    stems = {track_id: signal_data * gains[track_id] for track_id, signal_data in tracks.items()}
    musical_bus = stems["pad"] + stems["arp"] + stems["lead"]
    master = sum(stems.values(), start=np.zeros((total_samples, 2), dtype=np.float64))
    master += reverb(musical_bus, sample_rate)
    master = np.tanh(master * 1.16)
    fade = min(int(sample_rate * 0.035), total_samples // 2)
    master[:fade] *= np.linspace(0.0, 1.0, fade)[:, None]
    master[-fade:] *= np.linspace(1.0, 0.0, fade)[:, None]
    peak = float(np.max(np.abs(master)))
    if peak:
        master *= 0.89 / peak
    return master, stems


def pcm24_bytes(audio: np.ndarray) -> bytes:
    pcm = np.rint(np.clip(audio, -1.0, 1.0) * 8_388_607.0).astype(np.int32).reshape(-1)
    packed = np.empty((len(pcm), 3), dtype=np.uint8)
    packed[:, 0] = pcm & 0xFF
    packed[:, 1] = (pcm >> 8) & 0xFF
    packed[:, 2] = (pcm >> 16) & 0xFF
    return packed.tobytes()


def write_wav(path: Path, audio: np.ndarray, sample_rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(3)
        output.setframerate(sample_rate)
        output.writeframes(pcm24_bytes(audio))


def qa(audio: np.ndarray, sample_rate: int) -> dict[str, Any]:
    peak = float(np.max(np.abs(audio)))
    rms = np.sqrt(np.mean(np.square(audio), axis=0))
    correlation = float(np.corrcoef(audio[:, 0], audio[:, 1])[0, 1])
    return {
        "sample_rate": sample_rate,
        "channels": 2,
        "duration_seconds": len(audio) / sample_rate,
        "sample_peak": peak,
        "sample_peak_dbfs": dbfs(peak),
        "rms_dbfs": [dbfs(float(rms[0])), dbfs(float(rms[1]))],
        "dc_offset": [float(audio[:, 0].mean()), float(audio[:, 1].mean())],
        "stereo_correlation": correlation,
        "finite": bool(np.isfinite(audio).all()),
        "clipping": bool(peak >= 1.0),
    }


def render(spec_path: Path, output_dir: Path) -> dict[str, Any]:
    spec = load_spec(spec_path)
    master, stems = render_audio(spec)
    sample_rate = int(spec["sample_rate"])
    output_dir.mkdir(parents=True, exist_ok=True)
    master_path = output_dir / "lignes_de_nuit_30s.wav"
    write_wav(master_path, master, sample_rate)
    for track_id, stem in stems.items():
        write_wav(output_dir / "stems" / f"{track_id}.wav", stem, sample_rate)
    report = qa(master, sample_rate)
    report["master_sha256"] = hashlib.sha256(master_path.read_bytes()).hexdigest()
    report["title"] = spec["title"]
    report["seed"] = spec["seed"]
    report["spec_sha256"] = hashlib.sha256(spec_path.read_bytes()).hexdigest()
    (output_dir / "qa_report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Rend un morceau electronique proceduriel original.")
    parser.add_argument("--spec", type=Path, default=ROOT / "spec.json")
    parser.add_argument("--output", type=Path, default=ROOT / "renders")
    args = parser.parse_args()
    report = render(args.spec, args.output)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
