import pytest
import io
import wave
from backend.app.services.audio_processor import ProceduralAudioSynthesizer, AudioProcessor

def test_procedural_synthesizer_generates_valid_wav():
    # Synthesize 2.0 seconds of audio
    wav_bytes = ProceduralAudioSynthesizer.synthesize_composition(
        bpm=120,
        musical_key="F Minor",
        duration_seconds=2.0,
        seed=12345,
        genre="Synthwave"
    )

    assert len(wav_bytes) > 0
    # Must start with standard RIFF header
    assert wav_bytes.startswith(b"RIFF")

    # Read with python wave module to verify standard PCM compliance
    with wave.open(io.BytesIO(wav_bytes), "rb") as wf:
        channels = wf.getnchannels()
        width = wf.getsampwidth()
        rate = wf.getframerate()
        frames = wf.getnframes()
        duration = float(frames) / float(rate)

        assert channels == 1  # Mono
        assert width == 2     # 16-bit
        assert rate == 44100  # 44.1kHz
        assert pytest.approx(duration, abs=0.1) == 2.0

def test_extract_waveform_peaks():
    wav_bytes = ProceduralAudioSynthesizer.synthesize_composition(
        bpm=128,
        musical_key="A Minor",
        duration_seconds=1.5,
        seed=999
    )

    peaks = AudioProcessor.extract_waveform_peaks(wav_bytes, num_peaks=50)
    assert len(peaks) == 50
    assert all(isinstance(p, int) for p in peaks)
    assert all(0 <= p <= 100 for p in peaks)
    # Since audio has beats, at least some peaks should be significantly above minimum
    assert max(peaks) > 20

def test_audio_duration_and_slicing():
    wav_bytes = ProceduralAudioSynthesizer.synthesize_composition(
        bpm=120,
        musical_key="C Major",
        duration_seconds=3.0,
        seed=42
    )

    duration = AudioProcessor.get_audio_duration(wav_bytes)
    assert pytest.approx(duration, abs=0.1) == 3.0

    # Slice 1.0 second from 0.5s to 1.5s
    sliced = AudioProcessor.slice_audio(wav_bytes, start_sec=0.5, end_sec=1.5)
    sliced_duration = AudioProcessor.get_audio_duration(sliced)
    assert pytest.approx(sliced_duration, abs=0.1) == 1.0
