from __future__ import annotations

import argparse
from functools import lru_cache
import hashlib
import importlib.util
import json
import math
import re
import wave
from pathlib import Path
from typing import Any, Callable

import numpy as np
from scipy import signal


ROOT = Path(__file__).resolve().parent
PLUGINS_ROOT = ROOT.parent / "plugins"


def load_spec(path: Path) -> dict[str, Any]:
    spec = json.loads(path.read_text(encoding="utf-8"))
    required = {"schema_version", "title", "seed", "sample_rate", "duration_seconds", "tempo_bpm", "tracks", "harmony_midi", "render_plan"}
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


@lru_cache(maxsize=None)
def load_one_shot_plugin(plugin_id: str) -> tuple[dict[str, Any], dict[str, dict[str, Any]], Callable[[dict[str, Any], float, int], np.ndarray]]:
    if not re.fullmatch(r"[a-z][a-z0-9_]*", plugin_id):
        raise ValueError(f"Identifiant de plugin invalide: {plugin_id}")
    plugin_dir = (PLUGINS_ROOT / plugin_id).resolve()
    if PLUGINS_ROOT.resolve() not in plugin_dir.parents:
        raise ValueError(f"Plugin hors du dossier autorise: {plugin_id}")
    manifest = json.loads((plugin_dir / "manifest.json").read_text(encoding="utf-8"))
    presets = json.loads((plugin_dir / "presets.json").read_text(encoding="utf-8"))
    engine = manifest["engine"]
    module_name = engine["module"]
    if not re.fullmatch(r"[a-z][a-z0-9_]*", module_name):
        raise ValueError(f"Module de plugin invalide: {module_name}")
    module_spec = importlib.util.spec_from_file_location(
        f"morceau_electro_plugin_{plugin_id}_{module_name}",
        plugin_dir / f"{module_name}.py",
    )
    if module_spec is None or module_spec.loader is None:
        raise ValueError(f"Moteur de plugin introuvable: {plugin_id}")
    module = importlib.util.module_from_spec(module_spec)
    module_spec.loader.exec_module(module)
    renderer = getattr(module, engine["function"], None)
    if not callable(renderer):
        raise ValueError(f"Fonction de rendu invalide pour le plugin: {plugin_id}")
    return manifest, presets, renderer


def one_shot_plugin_voice(
    config: dict[str, Any], duration: float, velocity: float, pan: float, sample_rate: int
) -> np.ndarray:
    plugin_id = config["plugin_id"]
    preset_id = config["plugin_preset"]
    overrides = config.get("plugin_overrides", {})
    if not isinstance(overrides, dict):
        raise ValueError("plugin_overrides doit etre un objet")
    manifest, presets, renderer = load_one_shot_plugin(plugin_id)
    if manifest["engine"]["sample_rate"] != sample_rate:
        raise ValueError(f"Frequence incompatible pour le plugin {plugin_id}")
    if preset_id not in presets:
        raise ValueError(f"Preset inconnu pour le plugin {plugin_id}: {preset_id}")
    params = {**presets[preset_id], **overrides, "length": duration, "pan": pan}
    return renderer(params, velocity, sample_rate)


def clap(sample_rate: int, seed: int, amplitude: float, params: dict[str, Any]) -> np.ndarray:
    rng = np.random.default_rng(seed)
    count = int(params["duration"] * sample_rate)
    time = np.arange(count) / sample_rate
    noise = rng.standard_normal(count)
    sos = signal.butter(2, params["bandpass"], btype="bandpass", fs=sample_rate, output="sos")
    filtered = signal.sosfilt(sos, noise)
    bursts = sum(np.exp(-((time - position) / params["burst_width"]) ** 2) for position in params["bursts"])
    return filtered * bursts * np.exp(-time * params["decay"]) * amplitude


def hat(sample_rate: int, seed: int, amplitude: float, params: dict[str, Any]) -> np.ndarray:
    rng = np.random.default_rng(seed)
    count = int(params["duration"] * sample_rate)
    time = np.arange(count) / sample_rate
    noise = rng.standard_normal(count)
    sos = signal.butter(2, params["highpass"], btype="highpass", fs=sample_rate, output="sos")
    return signal.sosfilt(sos, noise) * np.exp(-time * params["decay"]) * amplitude


def bass_voice(sample_rate: int, note: int, duration: float, amplitude: float, params: dict[str, Any]) -> np.ndarray:
    count = int(duration * sample_rate)
    time = np.arange(count) / sample_rate
    frequency = midi_to_hz(note)
    phase = 2.0 * np.pi * frequency * time
    harmonic = sum(gain * np.sin((index + 1) * phase) for index, gain in enumerate(params["harmonics"]))
    tone = signal.sosfilt(signal.butter(2, params["lowpass"], btype="lowpass", fs=sample_rate, output="sos"), harmonic)
    return tone * envelope(count, sample_rate, *params["envelope"]) * amplitude


def pad_voice(sample_rate: int, notes: list[int], duration: float, amplitude: float, params: dict[str, Any]) -> np.ndarray:
    count = int(duration * sample_rate)
    time = np.arange(count) / sample_rate
    voice = np.zeros(count)
    for note in notes:
        frequency = midi_to_hz(note)
        for detune, gain in params["detunes"]:
            phase = 2.0 * np.pi * frequency * (1.0 + detune) * time
            voice += gain * (np.sin(phase) + params["second_harmonic"] * np.sin(2.0 * phase))
    filtered = signal.sosfilt(signal.butter(2, params["lowpass"], btype="lowpass", fs=sample_rate, output="sos"), voice)
    return filtered * envelope(count, sample_rate, *params["envelope"]) * amplitude


def pluck_voice(sample_rate: int, note: int, duration: float, amplitude: float, params: dict[str, Any]) -> np.ndarray:
    count = int(duration * sample_rate)
    time = np.arange(count) / sample_rate
    frequency = midi_to_hz(note)
    phase = 2.0 * np.pi * frequency * time
    harmonics = sum(gain * np.sin((index + 1) * phase) for index, gain in enumerate(params["harmonics"]))
    return harmonics * np.exp(-time * params["decay"]) * envelope(count, sample_rate, *params["envelope"]) * amplitude


def lead_voice(sample_rate: int, note: int, duration: float, amplitude: float, params: dict[str, Any]) -> np.ndarray:
    count = int(duration * sample_rate)
    time = np.arange(count) / sample_rate
    frequency = midi_to_hz(note)
    vibrato = params["vibrato_depth"] * np.sin(2.0 * np.pi * params["vibrato_hz"] * time)
    phase = 2.0 * np.pi * frequency * time * (1.0 + vibrato)
    sound = sum(gain * np.sin((index + 1) * phase) for index, gain in enumerate(params["harmonics"]))
    return sound * envelope(count, sample_rate, *params["envelope"]) * amplitude


def reverb(stereo_signal: np.ndarray, sample_rate: int, delays: list[list[float]]) -> np.ndarray:
    wet = np.zeros_like(stereo_signal)
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
    track_specs = {track["id"]: track for track in spec["tracks"]}
    tracks = {track_id: np.zeros((total_samples, 2), dtype=np.float64) for track_id in track_specs}
    plan = spec["render_plan"]

    def beat_to_sample(beat: float) -> int:
        return int(round(beat * seconds_per_beat * sample_rate))

    drum_plan = plan["drums"]
    drums = tracks[drum_plan["track_id"]]
    drum_instrument = track_specs[drum_plan["track_id"]]["instrument"]
    for beat in range(int(duration / seconds_per_beat)):
        bar = beat // beats_per_bar
        kick_plan = drum_plan["kick"]
        if bar >= kick_plan["from_bar"]:
            amplitude = kick_plan["amplitude_after"] if bar >= kick_plan["amplitude_before_bar"] else kick_plan["amplitude_before"]
            for offset in kick_plan["beats"]:
                add(
                    drums,
                    one_shot_plugin_voice(
                        drum_instrument["kick"],
                        kick_plan["duration"],
                        amplitude,
                        kick_plan["pan"],
                        sample_rate,
                    ),
                    beat_to_sample(beat + offset),
                )
        clap_plan = drum_plan["clap"]
        if bar >= clap_plan["from_bar"] and beat % beats_per_bar in clap_plan["beats_in_bar"]:
            add(drums, stereo(clap(sample_rate, seed + clap_plan["seed_offset"] + beat, clap_plan["amplitude"], drum_instrument["clap"]), clap_plan["pan"]), beat_to_sample(beat))
        hat_plan = drum_plan["hat"]
        if bar >= hat_plan["from_bar"]:
            for index, subdivision in enumerate(hat_plan["subdivisions"]):
                start = beat_to_sample(beat + subdivision)
                pan = hat_plan["pans"][index % len(hat_plan["pans"])]
                add(drums, stereo(hat(sample_rate, seed + hat_plan["seed_offset"] + int((beat + subdivision) * 2), hat_plan["amplitude"], drum_instrument["hat"]), pan), start)

    harmony_plan = plan["harmony"]
    pad_plan = harmony_plan["pad"]
    bass_plan = harmony_plan["bass"]
    arp_plan = harmony_plan["arp"]
    pad = tracks[pad_plan["track_id"]]
    bass = tracks[bass_plan["track_id"]]
    arp = tracks[arp_plan["track_id"]]
    for bar in range(bars):
        root = harmony[bar % len(harmony)]
        bar_beat = bar * beats_per_bar
        bar_duration = beats_per_bar * seconds_per_beat
        if bar < pad_plan["until_bar"]:
            amplitude = pad_plan["amplitude_after"] if bar >= pad_plan["amplitude_before_bar"] else pad_plan["amplitude_before"]
            notes = [root + offset for offset in pad_plan["note_offsets"]]
            add(pad, stereo(pad_voice(sample_rate, notes, bar_duration + pad_plan["duration_extra"], amplitude, track_specs[pad_plan["track_id"]]["instrument"]), pad_plan["pan"]), beat_to_sample(bar_beat))
        if bar >= bass_plan["from_bar"]:
            for step, root_offset in zip(bass_plan["steps"], bass_plan["root_steps"], strict=True):
                add(bass, stereo(bass_voice(sample_rate, root + root_offset, bass_plan["duration"], bass_plan["amplitude"], track_specs[bass_plan["track_id"]]["instrument"]), bass_plan["pan"]), beat_to_sample(bar_beat + step))
        if bar >= arp_plan["from_bar"]:
            notes = [root + interval + arp_plan["octave"] for interval in arp_plan["chord_intervals"]]
            for index, choice in enumerate(arp_plan["pattern"]):
                pan = arp_plan["pans"][index % len(arp_plan["pans"])]
                add(arp, stereo(pluck_voice(sample_rate, notes[choice], arp_plan["duration"], arp_plan["amplitude"], track_specs[arp_plan["track_id"]]["instrument"]), pan), beat_to_sample(bar_beat + index * arp_plan["step_beats"]))

    lead_plan = plan["lead"]
    lead = tracks[lead_plan["track_id"]]
    for beat, note in lead_plan["notes"]:
        if beat < duration / seconds_per_beat:
            add(lead, stereo(lead_voice(sample_rate, note, lead_plan["duration"], lead_plan["amplitude"], track_specs[lead_plan["track_id"]]["instrument"]), lead_plan["pan"]), beat_to_sample(beat))

    gains = {track_id: float(track["gain"]) for track_id, track in track_specs.items()}
    stems = {track_id: signal_data * gains[track_id] for track_id, signal_data in tracks.items()}
    mix_plan = plan["mix"]
    musical_bus = sum((stems[track_id] for track_id in mix_plan["reverb_track_ids"]), start=np.zeros((total_samples, 2), dtype=np.float64))
    master = sum(stems.values(), start=np.zeros((total_samples, 2), dtype=np.float64))
    master += reverb(musical_bus, sample_rate, mix_plan["reverb_delays"])
    master = np.tanh(master * mix_plan["master_gain"])
    fade = min(int(sample_rate * mix_plan["fade_seconds"]), total_samples // 2)
    master[:fade] *= np.linspace(0.0, 1.0, fade)[:, None]
    master[-fade:] *= np.linspace(1.0, 0.0, fade)[:, None]
    peak = float(np.max(np.abs(master)))
    if peak:
        master *= mix_plan["target_peak"] / peak
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
