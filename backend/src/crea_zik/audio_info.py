from __future__ import annotations

import hashlib
from math import sqrt
import wave
from pathlib import Path


def wav_info(path: Path) -> dict[str, float | int | str | bool]:
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        sample_rate = source.getframerate()
        sample_width = source.getsampwidth()
        frame_count = source.getnframes()
        frames = source.readframes(frame_count)
    if sample_width not in {1, 2, 3, 4}:
        raise ValueError("Unsupported PCM sample width")
    maximum = (1 << (sample_width * 8 - 1)) - 1
    peak = 0
    sample_sum = 0.0
    square_sum = 0.0
    sample_count = 0
    first_frame: list[float] | None = None
    second_frame: list[float] | None = None
    previous_frame: list[float] | None = None
    last_frame: list[float] | None = None
    left_sum = right_sum = left_squared = right_squared = cross_sum = 0.0
    frame_width = sample_width * channels
    for frame_offset in range(0, len(frames), frame_width):
        frame: list[float] = []
        for channel in range(channels):
            offset = frame_offset + channel * sample_width
            chunk = frames[offset:offset + sample_width]
            if sample_width == 1:
                signed_value = chunk[0] - 128
                scale = 127
            else:
                signed_value = int.from_bytes(chunk, byteorder="little", signed=True)
                scale = maximum
            peak = max(peak, abs(signed_value))
            normalized_value = signed_value / scale
            sample_sum += normalized_value
            square_sum += normalized_value**2
            sample_count += 1
            frame.append(normalized_value)
        if first_frame is None:
            first_frame = frame
        elif second_frame is None:
            second_frame = frame
        previous_frame, last_frame = last_frame, frame
        if channels == 2:
            left, right = frame
            left_sum += left
            right_sum += right
            left_squared += left**2
            right_squared += right**2
            cross_sum += left * right
    normalized_peak = peak / scale if scale else 0
    rms = sqrt(square_sum / sample_count) if sample_count else 0
    if channels == 2 and frame_count:
        covariance = cross_sum - left_sum * right_sum / frame_count
        left_variance = left_squared - left_sum**2 / frame_count
        right_variance = right_squared - right_sum**2 / frame_count
        correlation = covariance / sqrt(left_variance * right_variance) if left_variance > 0 and right_variance > 0 else 1
    else:
        correlation = 1.0
    loop_value_delta = max((abs(last - first) for first, last in zip(first_frame or [], last_frame or [])), default=0.0)
    loop_slope_delta = max(
        (abs((last - previous) - (second - first)) for first, second, previous, last in zip(first_frame or [], second_frame or [], previous_frame or [], last_frame or [])),
        default=0.0,
    )
    return {
        "wav": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "duration_seconds": frame_count / sample_rate if sample_rate else 0,
        "peak": normalized_peak,
        "dc_offset": sample_sum / sample_count if sample_count else 0,
        "is_clipping": normalized_peak >= .999,
        "rms": rms,
        "crest_factor": normalized_peak / rms if rms else 0,
        "is_silent": rms < .0001,
        "stereo_correlation": correlation,
        "loop_value_delta": loop_value_delta,
        "loop_slope_delta": loop_slope_delta,
        "sample_rate": sample_rate,
        "channels": channels,
    }
