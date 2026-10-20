/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

function encodeWav(samples: Float32Array, sampleRate = 16000): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: 'audio/wav' });
}

const PCM_WORKLET_CODE = `
class VoiceXPcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0] && input[0].length > 0) {
      this.port.postMessage(input[0]);
    }
    return true;
  }
}
registerProcessor('voicex-pcm-processor', VoiceXPcmProcessor);
`;

class AudioManager {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private muteGain: GainNode | null = null;
  private workletUrl: string | null = null;
  private pcmBuffers: Float32Array[] = [];
  private pcmSampleCount: number = 0;
  private isListening: boolean = false;
  private isRecording: boolean = false;
  private isSpeaking: boolean = false;
  private dataArray: Uint8Array | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private backendAudio: HTMLAudioElement | null = null;
  private backendAudioUrl: string | null = null;
  private onBargeInCallback: (() => void) | null = null;
  private vadInterval: number | null = null;
  private silenceInterval: number | null = null;
  private hasDetectedSpeechInTurn: boolean = false;
  private silenceStartTimestamp: number | null = null;
  private consecutiveSpeechFrames: number = 0;
  private timeDomainArray: Float32Array | null = null;
  private speechEndTimer: number | null = null;
  private silenceCallback: (() => void) | null = null;
  private permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported' = 'prompt';
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    if (typeof window !== 'undefined' && !('AudioContext' in window || 'webkitAudioContext' in window)) {
      this.permissionState = 'unsupported';
    }
  }

  public async getAvailableDevices(): Promise<{ inputs: AudioDevice[]; outputs: AudioDevice[] }> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return { inputs: [], outputs: [] };
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const inputs: AudioDevice[] = [];
      const outputs: AudioDevice[] = [];

      devices.forEach((d, index) => {
        if (d.kind === 'audioinput') {
          inputs.push({
            deviceId: d.deviceId || `mic-${index}`,
            label: d.label || `Microphone ${inputs.length + 1}`,
            kind: 'audioinput',
          });
        } else if (d.kind === 'audiooutput') {
          outputs.push({
            deviceId: d.deviceId || `speaker-${index}`,
            label: d.label || `Speaker ${outputs.length + 1}`,
            kind: 'audiooutput',
          });
        }
      });

      return { inputs, outputs };
    } catch {
      return { inputs: [], outputs: [] };
    }
  }

  public getPermissionStatus(): 'prompt' | 'granted' | 'denied' | 'unsupported' {
    return this.permissionState;
  }

  public async initMicrophone(deviceId?: string): Promise<boolean> {
    try {
      if (typeof window === 'undefined') return false;

      // Auto-listen can initialize another turn while the previous stream is
      // still warm. Release its nodes as well as its tracks before replacing it.
      this.stopMicrophone();

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        try {
          this.audioContext = new AudioCtx({ sampleRate: 16000 });
        } catch {
          this.audioContext = new AudioCtx();
        }
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      const constraints: MediaStreamConstraints = {
        audio: deviceId && deviceId !== 'default'
          ? { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true }
          : { echoCancellation: true, noiseSuppression: true },
      };

      this.micStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.permissionState = 'granted';

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.8;

      this.sourceNode = this.audioContext.createMediaStreamSource(this.micStream);
      this.sourceNode.connect(this.analyser);

      // Setup modern high-fidelity 16kHz PCM audio capture via AudioWorklet (0 deprecations)
      if (this.audioContext && 'audioWorklet' in this.audioContext) {
        try {
          if (!this.workletUrl) {
            const blob = new Blob([PCM_WORKLET_CODE], { type: 'application/javascript' });
            this.workletUrl = URL.createObjectURL(blob);
            await this.audioContext.audioWorklet.addModule(this.workletUrl);
          }

          this.workletNode = new AudioWorkletNode(this.audioContext, 'voicex-pcm-processor');
          const targetRate = 16000;
          this.workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
            if (!this.isRecording) return;
            const inputData = e.data;
            if (!inputData) return;
            const currentRate = this.audioContext?.sampleRate || 48000;
            if (currentRate === targetRate) {
              this.pcmBuffers.push(new Float32Array(inputData));
              this.pcmSampleCount += inputData.length;
            } else {
              const step = currentRate / targetRate;
              const newLen = Math.floor(inputData.length / step);
              const downsampled = new Float32Array(newLen);
              for (let i = 0; i < newLen; i++) {
                downsampled[i] = inputData[Math.floor(i * step)];
              }
              this.pcmBuffers.push(downsampled);
              this.pcmSampleCount += downsampled.length;
            }
          };

          this.sourceNode.connect(this.workletNode);
          this.muteGain = this.audioContext.createGain();
          this.muteGain.gain.value = 0;
          this.workletNode.connect(this.muteGain);
          this.muteGain.connect(this.audioContext.destination);
        } catch (procErr) {
          console.warn('AudioWorklet setup skipped, falling back to MediaRecorder:', procErr);
        }
      }

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isListening = true;
      this.startRecording();
      return true;
    } catch (err: unknown) {
      const error = err as { name?: string };
      if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
        this.permissionState = 'denied';
      } else {
        this.permissionState = 'denied';
      }
      this.isListening = false;
      return false;
    }
  }

  public startRecording(): boolean {
    this.pcmBuffers = [];
    this.pcmSampleCount = 0;
    this.recordedChunks = [];

    if (!this.micStream) return false;

    this.isRecording = true;
    if (!this.workletNode && typeof MediaRecorder !== 'undefined') {
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/webm')
            ? 'audio/webm'
            : '';
        this.mediaRecorder = mimeType
          ? new MediaRecorder(this.micStream, { mimeType })
          : new MediaRecorder(this.micStream);

        this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
          if (event.data && event.data.size > 0) {
            this.recordedChunks.push(event.data);
          }
        };
        // Record continuously without timeslice to prevent broken WebM container headers
        this.mediaRecorder.start();
      } catch (err) {
        console.warn('MediaRecorder start failed:', err);
      }
    }
    return true;
  }

  public async stopRecording(): Promise<Blob | null> {
    // 1. Primary path: Pristine 16kHz mono PCM WAV (Fastest & 100% reliable with Faster-Whisper)
    this.isRecording = false;
    if (this.pcmSampleCount > 0) {
      const merged = new Float32Array(this.pcmSampleCount);
      let offset = 0;
      for (const buf of this.pcmBuffers) {
        merged.set(buf, offset);
        offset += buf.length;
      }
      this.pcmBuffers = [];
      this.pcmSampleCount = 0;
      return encodeWav(merged, 16000);
    }

    // 2. Fallback path: MediaRecorder blob
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        if (this.recordedChunks.length > 0) {
          const mime = this.recordedChunks[0]?.type || 'audio/webm';
          const blob = new Blob(this.recordedChunks, { type: mime });
          resolve(blob.size >= 2000 ? blob : null);
        } else {
          resolve(null);
        }
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mime = this.recordedChunks[0]?.type || 'audio/webm';
        const blob = new Blob(this.recordedChunks, { type: mime });
        resolve(blob.size >= 2000 ? blob : null);
      };

      try {
        if (this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.requestData();
        }
        this.mediaRecorder.stop();
      } catch {
        resolve(null);
      }
    });
  }

  public stopMicrophone(): void {
    this.isRecording = false;
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
    this.recordedChunks = [];
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.workletNode) {
      try {
        this.workletNode.port.onmessage = null;
        this.workletNode.port.close();
        this.workletNode.disconnect();
      } catch {
        // ignore
      }
      this.workletNode = null;
    }
    if (this.muteGain) {
      try {
        this.muteGain.disconnect();
      } catch {
        // ignore
      }
      this.muteGain = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
    if (this.analyser) {
      try {
        this.analyser.disconnect();
      } catch {
        // ignore
      }
      this.analyser = null;
    }
    this.dataArray = null;
    this.pcmBuffers = [];
    this.pcmSampleCount = 0;
    this.stopSilenceDetector();
    this.isListening = false;
  }

  public isMicActive(): boolean {
    return this.isListening;
  }

  /**
   * Returns current audio frequency data for visualizations (0-255).
   */
  public getFrequencyData(): Uint8Array {
    if (this.analyser && this.dataArray) {
      (this.analyser as any).getByteFrequencyData(this.dataArray);
      return this.dataArray;
    }
    return new Uint8Array(64).fill(0);
  }

  /**
   * Returns normalized audio energy level (0.0 to 1.0)
   */
  public getVolumeLevel(): number {
    if (!this.analyser || !this.micStream) return 0;

    // High-precision Time-Domain RMS calculation
    if (!this.timeDomainArray || this.timeDomainArray.length !== this.analyser.fftSize) {
      this.timeDomainArray = new Float32Array(this.analyser.fftSize);
    }
    (this.analyser as any).getFloatTimeDomainData(this.timeDomainArray);

    let sumSquares = 0;
    for (let i = 0; i < this.timeDomainArray.length; i++) {
      const sample = this.timeDomainArray[i];
      sumSquares += sample * sample;
    }
    const rms = Math.sqrt(sumSquares / this.timeDomainArray.length);
    // Maps human speech range (0.012 to 0.25) to a clean 0.0 - 1.0 volume scale
    return Math.min(1, Math.max(0, rms * 4.5));
  }

  /**
   * Speak response using Web Speech API synthesis or mock player for local preview
   */
  public speak(
    text: string,
    options: {
      lang?: 'en' | 'hi' | string;
      rate?: number;
      onBoundary?: (charIndex: number) => void;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    } = {}
  ): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options.onEnd?.();
      return;
    }

    this.stopSpeaking();
    this.isSpeaking = true;

    // Detect if text contains Hindi Devanagari Unicode (\u0900-\u097F)
    const hasHindi = /[\u0900-\u097F]/.test(text);
    const targetLang = hasHindi ? 'hi-IN' : options.lang === 'hi' ? 'hi-IN' : 'en-US';

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = targetLang;
    utterance.rate = options.rate || 1.0;
    utterance.pitch = 1.0;

    // Try finding matching voice
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const matched = voices.find((v) =>
        hasHindi ? v.lang.startsWith('hi') : v.lang.startsWith('en')
      );
      if (matched) {
        utterance.voice = matched;
      }
    }

    utterance.onboundary = (e) => {
      options.onBoundary?.(e.charIndex);
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      options.onEnd?.();
    };

    utterance.onerror = (err) => {
      this.isSpeaking = false;
      this.currentUtterance = null;
      options.onError?.(err);
    };

    this.currentUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  }

  public stopSpeaking(): void {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (this.backendAudio) {
      try {
        this.backendAudio.onended = null;
        this.backendAudio.onerror = null;
        this.backendAudio.pause();
        this.backendAudio.currentTime = 0;
        this.backendAudio.src = '';
      } catch {
        // ignore
      }
      this.backendAudio = null;
    }
    if (this.backendAudioUrl) {
      try {
        URL.revokeObjectURL(this.backendAudioUrl);
      } catch {
        // ignore
      }
      this.backendAudioUrl = null;
    }
    this.isSpeaking = false;
    this.currentUtterance = null;
  }

  /**
   * Play assistant speech synthesized by the backend /api/tts endpoint
   * (Edge-TTS). Falls back to the Web Speech API when the backend
   * request fails (e.g. offline or no internet for the TTS service).
   */
  public async speakViaBackend(
    text: string,
    options: {
      baseUrl?: string;
      voice?: string;
      rate?: number;
      lang?: 'en' | 'hi' | string;
      onEnd?: () => void;
      onError?: (err: unknown) => void;
    } = {}
  ): Promise<void> {
    this.stopSpeaking();
    const trimmed = text.trim().slice(0, 3000);
    if (!trimmed) {
      options.onEnd?.();
      return;
    }
    const hasHindi = /[\u0900-\u097F]/.test(trimmed);
    const legacyVoiceMap: Record<string, string> = {
      'voice-aura': 'en-US-AriaNeural',
      'voice-neel': 'en-IN-PrabhatNeural',
      'voice-priya': 'hi-IN-SwaraNeural',
      'voice-echo': 'en-US-GuyNeural',
    };
    const validVoices = new Set([
      'en-US-AriaNeural',
      'en-US-GuyNeural',
      'en-IN-NeerjaNeural',
      'en-IN-PrabhatNeural',
      'hi-IN-SwaraNeural',
      'hi-IN-MadhurNeural',
    ]);
    let voice = options.voice ? (legacyVoiceMap[options.voice] || options.voice) : '';
    if (!validVoices.has(voice)) {
      voice = hasHindi ? 'hi-IN-SwaraNeural' : 'en-US-AriaNeural';
    } else if (hasHindi && !voice.startsWith('hi-')) {
      // Auto-switch to Hindi voice when text contains Devanagari but
      // the selected voice is English-only (can't pronounce Hindi).
      voice = 'hi-IN-SwaraNeural';
    }
    const baseUrl = (options.baseUrl || '').replace(/\/$/, '');
    try {
      const response = await fetch(`${baseUrl}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed, voice }),
      });
      if (!response.ok) {
        throw new Error(`TTS HTTP ${response.status}`);
      }
      const blob = await response.blob();
      if (!blob || blob.size === 0) {
        throw new Error('TTS returned empty audio');
      }
      this.playAudioBlob(blob, {
        onEnd: options.onEnd,
        onError: options.onError,
      });
    } catch (err) {
      // Graceful fallback: local Web Speech synthesis so the user
      // still hears the response.
      try {
        this.speak(trimmed, {
          lang: options.lang,
          rate: options.rate,
          onEnd: options.onEnd,
          onError: options.onError,
        });
      } catch (fallbackErr) {
        options.onError?.(fallbackErr);
      }
    }
  }

  /**
   * Play a raw audio blob (e.g. from /api/tts) via an object URL.
   * Revokes the URL when playback ends or fails.
   */
  public playAudioBlob(
    blob: Blob,
    options: { onEnd?: () => void; onError?: (err: unknown) => void } = {}
  ): void {
    if (typeof window === 'undefined') {
      options.onEnd?.();
      return;
    }
    this.stopSpeaking();
    this.isSpeaking = true;
    const url = URL.createObjectURL(blob);
    this.backendAudioUrl = url;
    const audio = new Audio(url);
    this.backendAudio = audio;
    audio.onended = () => {
      if (this.backendAudioUrl === url) {
        URL.revokeObjectURL(url);
        this.backendAudioUrl = null;
      }
      this.backendAudio = null;
      this.isSpeaking = false;
      options.onEnd?.();
    };
    audio.onerror = () => {
      if (this.backendAudioUrl === url) {
        URL.revokeObjectURL(url);
        this.backendAudioUrl = null;
      }
      this.backendAudio = null;
      this.isSpeaking = false;
      options.onError?.(new Error('Audio playback failed'));
    };
    audio.play().catch((err) => {
      this.isSpeaking = false;
      options.onError?.(err);
    });
  }

  public isAssistantSpeaking(): boolean {
    return this.isSpeaking;
  }

  private consecutiveBargeInFrames = 0;

  public setOnBargeIn(callback: () => void): void {
    this.onBargeInCallback = callback;
  }

  public notifySpeechDetectedDuringAssistant(): void {
    if (this.isSpeaking && this.onBargeInCallback) {
      console.log('[AudioManager] Speech recognition triggered instant barge-in!');
      this.stopSpeaking();
      this.onBargeInCallback();
    }
  }

  public startBargeInDetector(threshold = 0.075): void {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }

    this.consecutiveBargeInFrames = 0;

    this.vadInterval = window.setInterval(() => {
      if (this.isSpeaking) {
        const vol = this.getVolumeLevel();
        if (vol >= threshold) {
          this.consecutiveBargeInFrames++;
          // Require at least 2 consecutive checks (~130ms) to ensure it is continuous speech
          if (this.consecutiveBargeInFrames >= 2) {
            console.log('[AudioManager] Barge-in voice interruption detected! RMS volume:', vol);
            this.consecutiveBargeInFrames = 0;
            this.stopSpeaking();
            if (this.onBargeInCallback) {
              this.onBargeInCallback();
            }
          }
        } else {
          this.consecutiveBargeInFrames = 0;
        }
      } else {
        this.consecutiveBargeInFrames = 0;
      }
    }, 65);
  }

  public stopBargeInDetector(): void {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    this.consecutiveBargeInFrames = 0;
  }

  public startSilenceDetector(options: {
    speechThreshold?: number;
    silenceThreshold?: number;
    silenceTimeoutMs?: number;
    initialSilenceTimeoutMs?: number;
    onSpeechStart?: () => void;
    onSilenceDetected?: () => void;
    onInitialSilenceTimeout?: () => void;
  } = {}): void {
    this.stopSilenceDetector();

    this.silenceCallback = options.onSilenceDetected || null;
    const speechThreshold = options.speechThreshold ?? 0.04;
    const silenceThreshold = options.silenceThreshold ?? 0.025;
    const silenceTimeoutMs = options.silenceTimeoutMs ?? 1100;
    const initialSilenceTimeoutMs = options.initialSilenceTimeoutMs ?? 30000;

    this.hasDetectedSpeechInTurn = false;
    this.silenceStartTimestamp = null;
    this.consecutiveSpeechFrames = 0;
    const startListeningTime = Date.now();

    this.silenceInterval = window.setInterval(() => {
      if (!this.isListening) {
        this.stopSilenceDetector();
        return;
      }

      const vol = this.getVolumeLevel();

      // Phase 1: Wait for user to begin speaking
      if (!this.hasDetectedSpeechInTurn) {
        if (vol >= speechThreshold) {
          this.consecutiveSpeechFrames++;
          if (this.consecutiveSpeechFrames >= 2) {
            this.hasDetectedSpeechInTurn = true;
            this.silenceStartTimestamp = null;
            options.onSpeechStart?.();
          }
        } else {
          this.consecutiveSpeechFrames = Math.max(0, this.consecutiveSpeechFrames - 1);
          if (Date.now() - startListeningTime > initialSilenceTimeoutMs) {
            this.stopSilenceDetector();
            options.onInitialSilenceTimeout?.();
          }
        }
        return;
      }

      // Phase 2: Speech in progress, monitor for trailing silence to auto-finish turn
      if (vol >= speechThreshold) {
        // Continuous voice -> reset silence timer and cancel any candidate timer
        this.silenceStartTimestamp = null;
        if (this.speechEndTimer) {
          clearTimeout(this.speechEndTimer);
          this.speechEndTimer = null;
        }
      } else if (vol <= silenceThreshold) {
        // Volume dropped to ambient silence
        if (this.silenceStartTimestamp === null) {
          this.silenceStartTimestamp = Date.now();
        } else if (Date.now() - this.silenceStartTimestamp >= silenceTimeoutMs) {
          // Automatic end of turn triggered by silence
          const cb = this.silenceCallback;
          this.stopSilenceDetector();
          cb?.();
        }
      }
    }, 70);
  }

  /**
   * Called by speech recognition when words or speech events are detected
   */
  public markSpeechDetectedManually(): void {
    this.hasDetectedSpeechInTurn = true;
    this.silenceStartTimestamp = null;
    if (this.speechEndTimer) {
      clearTimeout(this.speechEndTimer);
      this.speechEndTimer = null;
    }
  }

  /**
   * Called when browser's native SpeechRecognition fires onspeechend
   */
  public notifySpeechEndCandidate(delayMs = 800): void {
    if (!this.hasDetectedSpeechInTurn || !this.isListening) return;
    if (this.speechEndTimer) {
      clearTimeout(this.speechEndTimer);
    }
    this.speechEndTimer = window.setTimeout(() => {
      if (this.isListening && this.hasDetectedSpeechInTurn) {
        const cb = this.silenceCallback;
        this.stopSilenceDetector();
        cb?.();
      }
    }, delayMs);
  }

  public stopSilenceDetector(): void {
    if (this.silenceInterval) {
      clearInterval(this.silenceInterval);
      this.silenceInterval = null;
    }
    if (this.speechEndTimer) {
      clearTimeout(this.speechEndTimer);
      this.speechEndTimer = null;
    }
    this.silenceStartTimestamp = null;
    this.consecutiveSpeechFrames = 0;
    this.hasDetectedSpeechInTurn = false;
    this.silenceCallback = null;
  }
}

export const audioManager = new AudioManager();
