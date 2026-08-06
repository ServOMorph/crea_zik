from __future__ import annotations

import hashlib
import wave
from math import sqrt
from pathlib import Path

import numpy as np
import scipy.signal


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
    all_frames: list[list[float]] = []
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
        all_frames.append(frame)
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

    # Reconstruction en numpy array pour True Peak et LUFS
    audio_data = np.array(all_frames, dtype=np.float32) if all_frames else np.zeros((0, channels), dtype=np.float32)

    # 1. Calcul du True Peak
    up_factor = 4 if sample_rate < 96000 else 2
    true_peak = 0.0
    if audio_data.size > 0:
        for c in range(channels):
            channel_data = audio_data[:, c]
            resampled = scipy.signal.resample_poly(channel_data, up=up_factor, down=1)
            channel_true_peak = float(np.max(np.abs(resampled)))
            true_peak = max(true_peak, channel_true_peak)

    # 2. Calcul du LUFS
    K_WEIGHTING_COEFFS = {
        44100: {
            "high_shelf_b": [1.5309095946396625, -2.651169032402396, 1.1691668584809876],
            "high_shelf_a": [1.0, -1.663750110244495, 0.7126575309627482],
            "high_pass_b": [0.994607809439911, -1.989215618879822, 0.994607809439911],
            "high_pass_a": [1.0, -1.9892010416922554, 0.9892301960673886]
        },
        48000: {
            "high_shelf_b": [1.5351828863637502, -2.691804030199196, 1.198426263333146],
            "high_shelf_a": [1.0, -1.6906995865986896, 0.7325047060963897],
            "high_pass_b": [0.9950442970178917, -1.9900885940357833, 0.9950442970178917],
            "high_pass_a": [1.0, -1.990076284018423, 0.9901009040531438]
        },
        88200: {
            "high_shelf_b": [1.5575449676922393, -2.9055589245339735, 1.3612457765728083],
            "high_shelf_a": [1.0, -1.8308421903092247, 0.844074010040298],
            "high_pass_b": [0.9972984432172307, -1.9945968864344614, 0.9972984432172307],
            "high_pass_a": [1.0, -1.9945932322923308, 0.9946005405765921]
        },
        96000: {
            "high_shelf_b": [1.559742819981814, -2.9266738501273637, 1.3781738571163336],
            "high_shelf_a": [1.0, -1.8445318192755606, 0.8557746462463444],
            "high_pass_b": [0.9975175360865743, -1.9950350721731487, 0.9975175360865743],
            "high_pass_a": [1.0, -1.9950319870290387, 0.9950381573172585]
        }
    }

    if sample_rate not in K_WEIGHTING_COEFFS:
        closest_rate = min(K_WEIGHTING_COEFFS.keys(), key=lambda r: abs(r - sample_rate))
        coeffs = K_WEIGHTING_COEFFS[closest_rate]
    else:
        coeffs = K_WEIGHTING_COEFFS[sample_rate]

    lufs = -70.0
    if audio_data.size > 0:
        filtered_data = np.zeros_like(audio_data)
        for c in range(channels):
            channel_data = audio_data[:, c]
            y_filtered = scipy.signal.lfilter(coeffs["high_shelf_b"], coeffs["high_shelf_a"], channel_data)
            filtered_data[:, c] = scipy.signal.lfilter(coeffs["high_pass_b"], coeffs["high_pass_a"], y_filtered)

        block_size = int(0.400 * sample_rate)
        block_step = int(0.100 * sample_rate)
        eps = 1e-15

        if len(audio_data) < block_size:
            z = np.mean(filtered_data**2, axis=0)
            sum_z = np.sum(z)
            lufs = float(-0.691 + 10.0 * np.log10(sum_z)) if sum_z > eps else -70.0
        else:
            z_blocks = []
            for start in range(0, len(audio_data) - block_size + 1, block_step):
                block = filtered_data[start : start + block_size, :]
                z_blocks.append(np.mean(block**2, axis=0))
            z_blocks = np.array(z_blocks)
            sum_z_blocks = np.sum(z_blocks, axis=1)
            l_j = -0.691 + 10.0 * np.log10(np.maximum(sum_z_blocks, eps))
            
            pass_abs = l_j >= -70.0
            if np.any(pass_abs):
                z_abs = z_blocks[pass_abs]
                l_abs = l_j[pass_abs]
                mean_z_abs = np.mean(z_abs, axis=0)
                sum_mean_z_abs = np.sum(mean_z_abs)
                if sum_mean_z_abs > eps:
                    l_temp = -0.691 + 10.0 * np.log10(sum_mean_z_abs)
                    relative_threshold = l_temp - 10.0
                    pass_rel = l_abs >= relative_threshold
                    if np.any(pass_rel):
                        z_final = z_abs[pass_rel]
                        mean_z_final = np.mean(z_final, axis=0)
                        sum_mean_z_final = np.sum(mean_z_final)
                        if sum_mean_z_final > eps:
                            lufs = float(-0.691 + 10.0 * np.log10(sum_mean_z_final))

    return {
        "wav": path.name,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "duration_seconds": frame_count / sample_rate if sample_rate else 0,
        "peak": normalized_peak,
        "true_peak": true_peak,
        "lufs": lufs,
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

