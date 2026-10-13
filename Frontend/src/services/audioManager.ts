/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

class AudioManager {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private dataArray: Uint8Array | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private onBargeInCallback: (() => void) | null = null;
  private vadInterval: number | null = null;
  private permissionState: 'prompt' | 'granted' | 'denied' | 'unsupported' = 'prompt';

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

      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      this.isListening = true;
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

  public stopMicrophone(): void {
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
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
    this.isSpeaking = false;
    this.currentUtterance = null;
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
