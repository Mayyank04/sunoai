# Fombo Music AI — Open-Weight Model Licensing & Rights Policy

---

## 1. Supported Open-Weight & Commercial Models

Fombo Music AI supports a strictly transparent, capability-aware tier of open-weight and commercial AI inference backends:

| Provider / Model | Architecture | Upstream License | Commercial Rights | Fombo Integration Status |
| :--- | :--- | :--- | :--- | :--- |
| **ACE-Step 1.5** | Diffusion Transformer (Audio) | Apache 2.0 / Open-Weight | **Eligible** (Commercial grant) | **Default Open-Weight Provider** |
| **HeartMuLa** | Multimodal Music LM | Open-Weight Research Grant | **Eligible** (Subject to terms) | **Alternative Open-Weight Provider**|
| **Fombo Procedural** | Mathematical Polyphonic DSP | Creative Commons CC0 | **Eligible** (Free Public Domain) | **Built-in Local Fallback** |
| **Audiocraft MusicGen** | Autoregressive EnCodec LM | MIT / CC-BY-NC (variant dependent)| **Tier Dependent** | Local / Cloud GPU Service |
| **Demucs v4** | Hybrid Transformer (HTDemucs)| MIT License | **Eligible** (Separation utility)| Dedicated Stem Worker Cluster |
| **Suno API Proxy** | Proprietary Latent Diffusion | Upstream Provider Service Agrmt | **Eligible on Pro/Studio** | Cloud API Adapter |
| **Stability Audio** | Latent Audio Diffusion | Stability Enterprise License | **Eligible on Pro/Studio** | Cloud API Adapter |

---

## 2. Commercial-Use Eligibility Rules

In compliance with international intellectual property guidelines and the United States Copyright Office (USCO) rulings:

1. **Free Tier Generations**:
   - Tagged as `Creative Commons Attribution-NonCommercial (CC-BY-NC 4.0)`.
   - Cannot be monetized on streaming services, commercial advertisements, or paid sync licensing.
2. **Pro & Studio Tier Generations**:
   - Tagged as `Commercial Rights Granted under Provider Terms`.
   - Permitted for Spotify, Apple Music, YouTube monetization, commercial sync, and video soundtracks.
3. **User Source Assets & Stem Isolation**:
   - If a track incorporates user-uploaded samples, loops, or vocals, commercial-use eligibility requires an explicit attestation (`original_composition`, `cc0_public_domain`, or `commercially_licensed`).
   - If an uploaded asset lacks verified commercial rights, the track status is automatically downgraded to `restricted` or `ineligible`.

---

## 3. Statutory Non-Infringement & Copyright Disclaimers

> **MANDATORY LEGAL DISCLOSURE (Affixed to All Generated Tracks & Manifests):**  
> *"Commercial-use eligibility is evaluated based on model provider terms and user source asset rights declarations. Fombo Music AI does NOT guarantee copyright registration, patent validity, or immunity from third-party infringement claims under U.S. Copyright Office and global IP regulations. Purely AI-generated latent audio lacks human authorship under USCO doctrines; creators are responsible for clearing third-party melodic similarities."*

---

## 4. C2PA Provenance & Cryptographic Manifest Standards

Every audio master rendered by Fombo Music AI receives an immutable C2PA provenance record containing:
- Unique Track UUID
- Upstream Model Provider & Checkpoint Version (e.g. `ace_step_1_5`)
- Generation Timestamp (ISO 8601 UTC)
- Prompt Reference & Conditioning Parameters (BPM, Key, Instrumentation)
- SHA-256 Digest of Master Audio Bytes
- Cryptographic Signature & Verification URL (`/api/v1/provenance/track/{id}/certificate`)
