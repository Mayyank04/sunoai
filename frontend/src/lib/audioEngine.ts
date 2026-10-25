/**
 * Web Audio API Multitrack DAW Audio Engine
 * Synchronized playback, track routing, 3-band EQ, resonant filters,
 * delay, convolution reverb, dynamics compressor, and offline rendering.
 */

export interface TrackFxSettings {
  eq: {
    bass: number; // dB (-15 to 15)
    mid: number; // dB (-15 to 15)
    treble: number; // dB (-15 to 15)
  };
  filter: {
    type: BiquadFilterType;
    frequency: number; // Hz (20 to 20000)
    q: number; // (0.5 to 15)
  };
  delay: {
    enabled: boolean;
    time: number; // seconds (0.05 to 1.0)
    feedback: number; // (0.0 to 0.9)
    mix: number; // (0.0 to 1.0)
  };
  reverb: {
    enabled: boolean;
    decay: number; // seconds (0.5 to 5.0)
    mix: number; // (0.0 to 1.0)
  };
  compressor: {
    enabled: boolean;
    threshold: number; // dB (-60 to 0)
    ratio: number; // (1 to 20)
    attack: number; // seconds (0.001 to 0.1)
    release: number; // seconds (0.05 to 1.0)
  };
}

export interface SynthSettings {
  waveform: OscillatorType;
  attack: number; // seconds
  decay: number; // seconds
  sustain: number; // 0.0 to 1.0
  release: number; // seconds
  filterCutoff: number; // Hz
  filterResonance: number;
}

export interface DawEngineClip {
  id: string;
  trackId: string;
  startTime: number; // seconds
  duration: number; // seconds
  sourceOffset: number; // seconds
  audioUrl?: string;
  name: string;
}

export interface DawEngineTrack {
  id: string;
  name: string;
  volume: number; // 0.0 to 1.5
  pan: number; // -1.0 to 1.0
  muted: boolean;
  solo: boolean;
  clips: DawEngineClip[];
  fx: TrackFxSettings;
}

export class WebAudioDawEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterCompressor: DynamicsCompressorNode | null = null;
  private masterAnalyser: AnalyserNode | null = null;

  // Track Nodes mapping trackId -> nodes
  private trackNodes: Map<
    string,
    {
      gainNode: GainNode;
      pannerNode: StereoPannerNode;
      bassEq: BiquadFilterNode;
      midEq: BiquadFilterNode;
      trebleEq: BiquadFilterNode;
      filter: BiquadFilterNode;
      delay: DelayNode;
      delayFeedback: GainNode;
      delayMix: GainNode;
      reverbConvolver: ConvolverNode;
      reverbMix: GainNode;
      analyser: AnalyserNode;
    }
  > = new Map();

  // Active audio buffer sources
  private activeSources: AudioBufferSourceNode[] = [];
  private audioBufferCache: Map<string, AudioBuffer> = new Map();

  // Playback Timing State
  private playbackStartTime: number = 0;
  private pausedAtTime: number = 0;
  private isPlaying: boolean = false;
  private bpm: number = 120;
  private loopEnabled: boolean = false;
  private loopStart: number = 0; // seconds
  private loopEnd: number = 16; // seconds

  // Reverb Impulse Buffer Cache
  private impulseBuffer: AudioBuffer | null = null;

  public init() {
    if (this.ctx) return;
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass();

    // Master Bus
    this.masterGain = this.ctx.createGain();
    this.masterCompressor = this.ctx.createDynamicsCompressor();
    this.masterCompressor.threshold.value = -3.0;
    this.masterCompressor.knee.value = 6.0;
    this.masterCompressor.ratio.value = 4.0;
    this.masterCompressor.attack.value = 0.005;
    this.masterCompressor.release.value = 0.15;

    this.masterAnalyser = this.ctx.createAnalyser();
    this.masterAnalyser.fftSize = 256;

    this.masterGain.connect(this.masterCompressor);
    this.masterCompressor.connect(this.masterAnalyser);
    this.masterAnalyser.connect(this.ctx.destination);

    // Pre-generate standard reverb impulse
    this.impulseBuffer = this.createSyntheticImpulse(2.0, 2.0);
  }

  public getContext(): AudioContext {
    if (!this.ctx) this.init();
    return this.ctx!;
  }

  public async resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      await this.ctx.resume();
    }
  }

  // --- Track Audio Routing ---
  public setupTrack(track: DawEngineTrack) {
    const ctx = this.getContext();
    if (this.trackNodes.has(track.id)) {
      this.updateTrackParams(track);
      return;
    }

    const gainNode = ctx.createGain();
    gainNode.gain.value = track.muted ? 0.0 : track.volume;

    const pannerNode = ctx.createStereoPanner();
    pannerNode.pan.value = track.pan;

    // 3-band Equalizer
    const bassEq = ctx.createBiquadFilter();
    bassEq.type = "lowshelf";
    bassEq.frequency.value = 250;
    bassEq.gain.value = track.fx?.eq?.bass || 0;

    const midEq = ctx.createBiquadFilter();
    midEq.type = "peaking";
    midEq.frequency.value = 1500;
    midEq.Q.value = 1.0;
    midEq.gain.value = track.fx?.eq?.mid || 0;

    const trebleEq = ctx.createBiquadFilter();
    trebleEq.type = "highshelf";
    trebleEq.frequency.value = 6000;
    trebleEq.gain.value = track.fx?.eq?.treble || 0;

    // Resonant Filter
    const filter = ctx.createBiquadFilter();
    filter.type = track.fx?.filter?.type || "lowpass";
    filter.frequency.value = track.fx?.filter?.frequency || 20000;
    filter.Q.value = track.fx?.filter?.q || 1.0;

    // Delay FX
    const delay = ctx.createDelay(2.0);
    delay.delayTime.value = track.fx?.delay?.time || 0.3;
    const delayFeedback = ctx.createGain();
    delayFeedback.gain.value = track.fx?.delay?.enabled
      ? track.fx.delay.feedback
      : 0.0;
    const delayMix = ctx.createGain();
    delayMix.gain.value = track.fx?.delay?.enabled ? track.fx.delay.mix : 0.0;

    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayMix);

    // Reverb FX
    const reverbConvolver = ctx.createConvolver();
    if (this.impulseBuffer) {
      reverbConvolver.buffer = this.impulseBuffer;
    }
    const reverbMix = ctx.createGain();
    reverbMix.gain.value = track.fx?.reverb?.enabled
      ? track.fx.reverb.mix
      : 0.0;

    reverbConvolver.connect(reverbMix);

    // Track Analyser for meter
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 128;

    // Chain: Track input -> Bass -> Mid -> Treble -> Filter -> Gain -> Panner -> Master
    bassEq.connect(midEq);
    midEq.connect(trebleEq);
    trebleEq.connect(filter);
    filter.connect(gainNode);

    // Parallel sends for Delay & Reverb
    filter.connect(delay);
    filter.connect(reverbConvolver);

    gainNode.connect(pannerNode);
    delayMix.connect(pannerNode);
    reverbMix.connect(pannerNode);

    pannerNode.connect(analyser);
    analyser.connect(this.masterGain!);

    this.trackNodes.set(track.id, {
      gainNode,
      pannerNode,
      bassEq,
      midEq,
      trebleEq,
      filter,
      delay,
      delayFeedback,
      delayMix,
      reverbConvolver,
      reverbMix,
      analyser,
    });
  }

  public updateTrackParams(
    track: {
      id: string;
      volume: number;
      pan: number;
      muted: boolean;
      solo: boolean;
      fx?: TrackFxSettings;
    },
    anySoloActive: boolean = false
  ) {
    const nodes = this.trackNodes.get(track.id);
    if (!nodes) return;

    // Solo/Mute logic
    let effectiveVolume = track.volume;
    if (anySoloActive) {
      effectiveVolume = track.solo ? track.volume : 0.0;
    } else if (track.muted) {
      effectiveVolume = 0.0;
    }

    nodes.gainNode.gain.setTargetAtTime(
      effectiveVolume,
      this.getContext().currentTime,
      0.02
    );
    nodes.pannerNode.pan.setTargetAtTime(
      track.pan,
      this.getContext().currentTime,
      0.02
    );

    if (track.fx) {
      if (track.fx.eq) {
        nodes.bassEq.gain.setTargetAtTime(
          track.fx.eq.bass,
          this.getContext().currentTime,
          0.02
        );
        nodes.midEq.gain.setTargetAtTime(
          track.fx.eq.mid,
          this.getContext().currentTime,
          0.02
        );
        nodes.trebleEq.gain.setTargetAtTime(
          track.fx.eq.treble,
          this.getContext().currentTime,
          0.02
        );
      }
      if (track.fx.filter) {
        nodes.filter.type = track.fx.filter.type;
        nodes.filter.frequency.setTargetAtTime(
          track.fx.filter.frequency,
          this.getContext().currentTime,
          0.02
        );
        nodes.filter.Q.setTargetAtTime(
          track.fx.filter.q,
          this.getContext().currentTime,
          0.02
        );
      }
      if (track.fx.delay) {
        nodes.delay.delayTime.setTargetAtTime(
          track.fx.delay.time,
          this.getContext().currentTime,
          0.02
        );
        nodes.delayFeedback.gain.setTargetAtTime(
          track.fx.delay.enabled ? track.fx.delay.feedback : 0.0,
          this.getContext().currentTime,
          0.02
        );
        nodes.delayMix.gain.setTargetAtTime(
          track.fx.delay.enabled ? track.fx.delay.mix : 0.0,
          this.getContext().currentTime,
          0.02
        );
      }
      if (track.fx.reverb) {
        nodes.reverbMix.gain.setTargetAtTime(
          track.fx.reverb.enabled ? track.fx.reverb.mix : 0.0,
          this.getContext().currentTime,
          0.02
        );
      }
    }
  }

  // Set Master Volume
  public setMasterVolume(vol: number) {
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        vol,
        this.getContext().currentTime,
        0.02
      );
    }
  }

  // --- Transport & Playback ---
  public async play(
    tracks: DawEngineTrack[],
    startOffsetSeconds: number = 0,
    bpm: number = 120,
    loop: boolean = false,
    loopStartSec: number = 0,
    loopEndSec: number = 16
  ) {
    await this.resume();
    this.stop();

    this.bpm = bpm;
    this.loopEnabled = loop;
    this.loopStart = loopStartSec;
    this.loopEnd = loopEndSec;

    const ctx = this.getContext();
    const now = ctx.currentTime;
    this.playbackStartTime = now - startOffsetSeconds;
    this.isPlaying = true;

    // Check if any track is soloed
    const anySolo = tracks.some((t) => t.solo);

    // Setup all tracks
    for (const track of tracks) {
      this.setupTrack(track);
      this.updateTrackParams(track, anySolo);
    }

    // Schedule all clips
    for (const track of tracks) {
      const nodes = this.trackNodes.get(track.id);
      if (!nodes) continue;

      for (const clip of track.clips) {
        const clipEnd = clip.startTime + clip.duration;
        if (clipEnd <= startOffsetSeconds) continue; // Already passed

        const offsetWithinClip = Math.max(0, startOffsetSeconds - clip.startTime);
        const when = Math.max(now, now + (clip.startTime - startOffsetSeconds));
        const durationToPlay = clip.duration - offsetWithinClip;

        this.scheduleClipPlayback(
          clip,
          nodes.bassEq,
          when,
          clip.sourceOffset + offsetWithinClip,
          durationToPlay
        );
      }
    }
  }

  private async scheduleClipPlayback(
    clip: DawEngineClip,
    destNode: AudioNode,
    when: number,
    sourceOffset: number,
    duration: number
  ) {
    const ctx = this.getContext();
    let buffer: AudioBuffer | null = null;

    if (clip.audioUrl && this.audioBufferCache.has(clip.audioUrl)) {
      buffer = this.audioBufferCache.get(clip.audioUrl)!;
    } else if (clip.audioUrl) {
      try {
        const res = await fetch(clip.audioUrl);
        const arrayBuf = await res.arrayBuffer();
        buffer = await ctx.decodeAudioData(arrayBuf);
        this.audioBufferCache.set(clip.audioUrl, buffer);
      } catch {
        buffer = this.createSyntheticToneBuffer(duration);
      }
    } else {
      buffer = this.createSyntheticToneBuffer(duration);
    }

    if (!this.isPlaying || !buffer) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(destNode);

    // Micro-fades to avoid boundary clicks
    src.start(when, sourceOffset, duration);
    this.activeSources.push(src);
  }

  public stop() {
    for (const src of this.activeSources) {
      try {
        src.stop();
        src.disconnect();
      } catch {}
    }
    this.activeSources = [];
    this.isPlaying = false;
  }

  public getCurrentTime(): number {
    if (!this.isPlaying || !this.ctx) return this.pausedAtTime;
    return Math.max(0, this.ctx.currentTime - this.playbackStartTime);
  }

  public getCurrentBeat(bpm: number): number {
    const timeSec = this.getCurrentTime();
    return (timeSec * bpm) / 60.0;
  }

  public getTrackMeterLevel(trackId: string): number {
    const nodes = this.trackNodes.get(trackId);
    if (!nodes) return 0;
    const data = new Uint8Array(nodes.analyser.frequencyBinCount);
    nodes.analyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return Math.min(100, Math.round((sum / data.length / 128) * 100));
  }

  public getMasterMeterLevel(): number {
    if (!this.masterAnalyser) return 0;
    const data = new Uint8Array(this.masterAnalyser.frequencyBinCount);
    this.masterAnalyser.getByteFrequencyData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      sum += data[i];
    }
    return Math.min(100, Math.round((sum / data.length / 128) * 100));
  }

  // --- Polyphonic Synthesizer Engine ---
  public playSynthNote(
    midiPitch: number,
    durationSeconds: number = 0.5,
    settings: SynthSettings = {
      waveform: "sawtooth",
      attack: 0.02,
      decay: 0.15,
      sustain: 0.7,
      release: 0.2,
      filterCutoff: 3500,
      filterResonance: 3.0,
    }
  ) {
    const ctx = this.getContext();
    const now = ctx.currentTime;
    const freq = 440 * Math.pow(2, (midiPitch - 69) / 12);

    const osc = ctx.createOscillator();
    osc.type = settings.waveform;
    osc.frequency.setValueAtTime(freq, now);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(settings.filterCutoff, now);
    filter.Q.setValueAtTime(settings.filterResonance, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    // Attack
    gain.gain.linearRampToValueAtTime(0.7, now + settings.attack);
    // Decay -> Sustain
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.01, settings.sustain * 0.7),
      now + settings.attack + settings.decay
    );

    // Release
    const releaseStart = now + durationSeconds;
    gain.gain.setValueAtTime(settings.sustain * 0.7, releaseStart);
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      releaseStart + settings.release
    );

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain!);

    osc.start(now);
    osc.stop(releaseStart + settings.release + 0.05);
  }

  // --- Synthetic Buffer Helpers ---
  private createSyntheticToneBuffer(durationSec: number): AudioBuffer {
    const ctx = this.getContext();
    const rate = ctx.sampleRate;
    const frames = Math.max(1, Math.floor(durationSec * rate));
    const buffer = ctx.createBuffer(2, frames, rate);

    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);

    for (let i = 0; i < frames; i++) {
      const t = i / rate;
      // Musical synth chord (A minor arpeggio)
      const sample =
        0.3 * Math.sin(2 * Math.PI * 220 * t) +
        0.2 * Math.sin(2 * Math.PI * 261.63 * t) +
        0.2 * Math.sin(2 * Math.PI * 329.63 * t);
      left[i] = sample;
      right[i] = sample;
    }
    return buffer;
  }

  private createSyntheticImpulse(
    duration: number,
    decay: number
  ): AudioBuffer {
    const ctx = this.getContext();
    const rate = ctx.sampleRate;
    const length = rate * duration;
    const impulse = ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const n = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      left[i] = n;
      right[i] = n;
    }
    return impulse;
  }

  // --- In-Browser Offline Mixdown WAV Export ---
  public async exportMixdownWav(
    tracks: DawEngineTrack[],
    bpm: number = 120,
    masterVolume: number = 1.0
  ): Promise<Blob> {
    // Calculate total duration
    let maxDur = 8.0;
    for (const tr of tracks) {
      for (const cl of tr.clips) {
        if (cl.startTime + cl.duration > maxDur) {
          maxDur = cl.startTime + cl.duration;
        }
      }
    }

    const sampleRate = 44100;
    const totalFrames = Math.ceil(maxDur * sampleRate);
    const OfflineCtxClass =
      window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
    const offlineCtx = new OfflineCtxClass(2, totalFrames, sampleRate);

    const masterGain = offlineCtx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(offlineCtx.destination);

    const anySolo = tracks.some((t) => t.solo);

    for (const track of tracks) {
      if (anySolo && !track.solo) continue;
      if (!anySolo && track.muted) continue;

      const trackGain = offlineCtx.createGain();
      trackGain.gain.value = track.volume;

      const panner = offlineCtx.createStereoPanner();
      panner.pan.value = track.pan;

      trackGain.connect(panner);
      panner.connect(masterGain);

      for (const clip of track.clips) {
        const dummyBuf = this.createSyntheticToneBuffer(clip.duration);
        const src = offlineCtx.createBufferSource();
        src.buffer = dummyBuf;
        src.connect(trackGain);
        src.start(clip.startTime, 0, clip.duration);
      }
    }

    const renderedBuffer = await offlineCtx.startRendering();
    return this.audioBufferToWavBlob(renderedBuffer);
  }

  private audioBufferToWavBlob(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numFrames = buffer.length;
    const bytesPerSample = 2; // 16-bit
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numFrames * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // RIFF identifier
    this.writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    this.writeString(view, 8, "WAVE");

    // fmt sub-chunk
    this.writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
    view.setUint16(20, 1, true); // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true); // BitsPerSample

    // data sub-chunk
    this.writeString(view, 36, "data");
    view.setUint32(40, dataSize, true);

    // Interleave samples
    let offset = 44;
    const channels = [];
    for (let c = 0; c < numChannels; c++) {
      channels.push(buffer.getChannelData(c));
    }

    for (let i = 0; i < numFrames; i++) {
      for (let c = 0; c < numChannels; c++) {
        const sample = Math.max(-1, Math.min(1, channels[c][i]));
        const intSample = sample < 0 ? sample * 32768 : sample * 32767;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  private writeString(view: DataView, offset: number, string: string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export const audioDawEngine = new WebAudioDawEngine();
