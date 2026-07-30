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
    assert set(report.issues) == {"clipping", "excessive_dc_offset"}


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
