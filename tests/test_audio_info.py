import wave
from pathlib import Path

from crea_zik.audio_info import wav_info
from crea_zik.qa import evaluate_wav
from uuid import uuid4


def test_wav_info_reports_dc_offset_and_clipping(tmp_path: Path) -> None:
    source = tmp_path / "signal.wav"
    with wave.open(str(source), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(48_000)
        output.writeframes(b"\xff\x7f\xff\x7f\x00\x00\x00\x00")

    info = wav_info(source)

    assert info["peak"] == 1
    assert info["is_clipping"] is True
    assert info["dc_offset"] == .5
    assert info["rms"] > 0
    assert info["crest_factor"] > 1


def test_qa_blocks_clipping_and_excessive_dc(tmp_path: Path) -> None:
    source = tmp_path / "invalid.wav"
    with wave.open(str(source), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(48_000)
        output.writeframes(b"\xff\x7f" * 32)

    report = evaluate_wav(uuid4(), source)

    assert report.passed is False
    assert set(report.issues) == {"clipping", "excessive_dc_offset", "true_peak_clipping", "excessive_loudness"}



def test_qa_detects_a_loop_discontinuity(tmp_path: Path) -> None:
    source = tmp_path / "loop.wav"
    with wave.open(str(source), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(48_000)
        output.writeframes(b"\x00\x00\x00\x00\x00\x40\x00\x40")

    info = wav_info(source)
    report = evaluate_wav(uuid4(), source, loop=True)

    assert info["stereo_correlation"] == 1
    assert info["loop_value_delta"] > .01
    assert "loop_discontinuity" in report.issues


def test_wav_info_calculates_true_peak_and_lufs(tmp_path: Path) -> None:
    # 1. Silence
    silence_path = tmp_path / "silence.wav"
    with wave.open(str(silence_path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(48000)
        output.writeframes(b"\x00\x00" * 4800)

    info_silence = wav_info(silence_path)
    assert info_silence["true_peak"] == 0.0
    assert info_silence["lufs"] == -70.0

    # 2. Sinus pur à 1000 Hz, -3 dBFS (amplitude 0.7071)
    sinus_path = tmp_path / "sinus.wav"
    import numpy as np
    fs = 48000
    t = np.linspace(0, 0.5, int(fs * 0.5), endpoint=False)
    amplitude = 0.7071
    data = (amplitude * np.sin(2.0 * np.pi * 1000.0 * t) * 32767).astype(np.int16)
    with wave.open(str(sinus_path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(fs)
        output.writeframes(data.tobytes())

    info_sinus = wav_info(sinus_path)
    assert abs(info_sinus["peak"] - 0.7071) < 0.01
    assert abs(info_sinus["true_peak"] - info_sinus["peak"]) < 0.01
    assert -12.0 < info_sinus["lufs"] < -3.0

    # 3. Inter-sample peak connu
    # Motif: [0.7071, 0.7071, -0.7071, -0.7071] répété
    # Sample Peak = 0.7071 (~ -3 dBFS)
    # True Peak (interpolé) = 1.0 (0 dBFS)
    isp_path = tmp_path / "isp.wav"
    pattern = np.array([0.7071, 0.7071, -0.7071, -0.7071])
    n_repeats = 12000
    data_isp = np.tile(pattern, n_repeats)
    data_isp_int = (data_isp * 32767).astype(np.int16)
    with wave.open(str(isp_path), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(fs)
        output.writeframes(data_isp_int.tobytes())

    info_isp = wav_info(isp_path)
    assert abs(info_isp["peak"] - 0.7071) < 0.01
    assert info_isp["true_peak"] > 0.95

