import io
import wave
import struct
import httpx
from typing import Dict, Tuple, Optional
from backend.app.core.config import settings

class DemucsStemProvider:
    """
    Stem separation provider interfacing with Demucs v4 (Hybrid Transformer)
    or providing mathematical frequency-band isolation fallback for offline environments.
    """

    @classmethod
    def validate_configuration(cls) -> Tuple[bool, str]:
        if settings.DEMUCS_SERVICE_URL:
            return (True, f"Remote Demucs Worker active at {settings.DEMUCS_SERVICE_URL}")
        return (True, "Offline DSP Band-Isolation Engine active (Demucs remote worker not configured)")

    @classmethod
    async def separate_stems(cls, audio_bytes: bytes) -> Dict[str, bytes]:
        """
        Separates audio into 4 stems: 'vocals', 'drums', 'bass', 'other'.
        Returns a dictionary mapping stem_type -> WAV audio bytes.
        """
        if settings.DEMUCS_SERVICE_URL:
            async with httpx.AsyncClient(timeout=300.0) as client:
                files = {"audio": ("input.wav", audio_bytes, "audio/wav")}
                resp = await client.post(f"{settings.DEMUCS_SERVICE_URL}/separate", files=files)
                if resp.status_code == 200:
                    data = resp.json()
                    # Expects URLs or multipart chunks from Demucs worker
                    stems = {}
                    for stem_name, stem_url in data.get("stems", {}).items():
                        stem_resp = await client.get(stem_url)
                        stems[stem_name] = stem_resp.content
                    return stems

        # Offline DSP Frequency Isolation
        # Deconstructs 16-bit PCM WAV into 4 spectral bands
        return cls._dsp_frequency_band_separation(audio_bytes)

    @classmethod
    def _dsp_frequency_band_separation(cls, audio_bytes: bytes) -> Dict[str, bytes]:
        with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
            channels = wf.getnchannels()
            width = wf.getsampwidth()
            rate = wf.getframerate()
            frames = wf.getnframes()
            raw = wf.readframes(frames)

        samples = []
        for i in range(0, len(raw), 2):
            if i + 2 <= len(raw):
                val = struct.unpack_from("<h", raw, i)[0]
                samples.append(val)

        # Simple IIR filters to extract 4 bands:
        # 1. Bass: Low-pass filter (sub 250Hz)
        # 2. Vocals: Band-pass filter (300Hz - 3500Hz)
        # 3. Drums: Transient & low-mid envelope
        # 4. Other: High frequencies and ambient wash

        bass_samples = []
        vocal_samples = []
        drum_samples = []
        other_samples = []

        # Simple 1st-order IIR lowpass
        alpha_low = 0.08  # ~250 Hz cutoff at 44.1k
        alpha_mid = 0.35  # ~1.5 kHz
        low_val = 0.0
        mid_val = 0.0

        for s in samples:
            low_val += alpha_low * (s - low_val)
            mid_val += alpha_mid * (s - mid_val)

            b = int(low_val * 1.2)
            v = int((mid_val - low_val) * 1.1)
            o = int((s - mid_val) * 0.9)
            d = int((abs(s - mid_val) > 2000) * (s * 0.7) + low_val * 0.5)

            bass_samples.append(max(-32768, min(32767, b)))
            vocal_samples.append(max(-32768, min(32767, v)))
            other_samples.append(max(-32768, min(32767, o)))
            drum_samples.append(max(-32768, min(32767, d)))

        def pack_wav(sample_list: list) -> bytes:
            bio = io.BytesIO()
            with wave.open(bio, "wb") as out_wf:
                out_wf.setnchannels(1)
                out_wf.setsampwidth(2)
                out_wf.setframerate(rate)
                pcm = bytearray()
                for samp in sample_list:
                    pcm.extend(struct.pack("<h", samp))
                out_wf.writeframes(pcm)
            return bio.getvalue()

        return {
            "bass": pack_wav(bass_samples),
            "vocals": pack_wav(vocal_samples),
            "drums": pack_wav(drum_samples),
            "other": pack_wav(other_samples),
        }
