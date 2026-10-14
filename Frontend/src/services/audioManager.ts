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

class AudioManager {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private silentGainNode: GainNode | null = null;
  private pcmBuffers: Float32Array[] = [];
  private pcmSampleCount: number = 0;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private dataArray: Uint8Array | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private backendAudio: HTMLAudioElement | null = null;
  private backendAudioUrl: string | null = null;
  private onBargeInCallback: (() => void) | null = null;
  private vadInterval: number | null = null;
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

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!this.audioContext || this.audioContext.state === 'closed') {
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Stop existing stream if changing device
      if (this.micStream) {
        this.micStream.getTracks().forEach((t) => t.stop());
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

      // Setup high-fidelity 16kHz PCM audio capture
      try {
        const bufferSize = 4096;
        this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        this.silentGainNode = this.audioContext.createGain();
        this.silentGainNode.gain.value = 0;

        const targetRate = 16000;
        this.processorNode.onaudioprocess = (e: AudioProcessingEvent) => {
          if (!this.isListening) return;
          const inputData = e.inputBuffer.getChannelData(0);
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

        this.sourceNode.connect(this.processorNode);
        this.processorNode.connect(this.silentGainNode);
        this.silentGainNode.connect(this.audioContext.destination);
      } catch (procErr) {
        console.warn('ScriptProcessor setup skipped, falling back to MediaRecorder:', procErr);
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

    if (typeof MediaRecorder !== 'undefined') {
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
    if (this.pcmSampleCount >= 3200) {
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
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    if (this.processorNode) {
      try {
        this.processorNode.disconnect();
      } catch {
        // ignore
      }
      this.processorNode = null;
    }
    if (this.silentGainNode) {
      try {
        this.silentGainNode.disconnect();
      } catch {
        // ignore
      }
      this.silentGainNode = null;
    }
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }
    this.isListening = false;
  }

  public isMicActive(): boolean {
    return this.isListening;
  }

  /**
   * Returns current audio frequency data for visualizations (0-255).
   */
  public getFrequencyData(): Uint8Array {
    if (this.isListening && this.analyser && this.dataArray) {
      (this.analyser as any).getByteFrequencyData(this.dataArray);
      return this.dataArray;
    }
    return new Uint8Array(64).fill(0);
  }

  /**
   * Returns normalized audio energy level (0.0 to 1.0)
   */
  public getVolumeLevel(): number {
    if (!this.isListening || !this.analyser || !this.dataArray) return 0;
    (this.analyser as any).getByteFrequencyData(this.dataArray);
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }
    const avg = sum / this.dataArray.length;
    return Math.min(1, avg / 128);
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
        this.backendAudio.pause();
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
    const voice =
      options.voice || (hasHindi ? 'hi-IN-SwaraNeural' : 'en-US-AriaNeural');
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

  public setOnBargeIn(callback: () => void): void {
    this.onBargeInCallback = callback;
  }

  public startBargeInDetector(threshold = 0.35): void {
    if (this.vadInterval) return;

    this.vadInterval = window.setInterval(() => {
      if (this.isSpeaking && this.isListening) {
        const vol = this.getVolumeLevel();
        if (vol > threshold) {
          // Barge-in detected! User spoke over the assistant
          this.stopSpeaking();
          if (this.onBargeInCallback) {
            this.onBargeInCallback();
          }
        }
      }
    }, 80);
  }

  public stopBargeInDetector(): void {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
  }
}

export const audioManager = new AudioManager();
