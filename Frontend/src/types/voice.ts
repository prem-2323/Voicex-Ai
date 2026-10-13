/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type VoiceState = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'speaking' | 'interrupted';

export type LanguageCode = 'en' | 'hi' | 'auto';

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'female' | 'male' | 'neutral';
  language: 'en' | 'hi' | 'multilingual';
  accent: string;
  sampleText: string;
  isLocalWeight: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  detectedLanguage?: 'English' | 'Hindi';
  timestamp: number;
  audioDurationSec?: number;
  latencyMetrics?: {
    sttMs: number;
    ttftMs: number;
    ttfaMs: number;
    totalMs: number;
    rtf: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
  primaryLanguage: LanguageCode;
}

export interface BenchmarkHistoryEntry {
  id: string;
  timestamp: number;
  label: string;
  sttMs: number;
  ttftMs: number;
  ttfaMs: number;
  totalMs: number;
  rtf: number;
  isSimulated: boolean;
}

export interface PerformanceMetrics {
  sttDurationMs: number;        // Speech-to-text duration
  timeToFirstTokenMs: number;   // TTFT: Time to first LLM token
  timeToFirstAudioMs: number;   // TTFA: Time to first audible audio
  totalResponseMs: number;      // Total end-to-end response time
  realTimeFactor: number;       // RTF: TTS generation duration / audio length
  successfulTurnRate: number;   // Percentage e.g. 99.2%
  isSimulatedPreview: boolean;  // True when running without connected live FastAPI backend
  benchmarkHistory: BenchmarkHistoryEntry[];
  deviceCompute: {
    deviceType: string;         // e.g. "Host Not Connected (Preview Mode)" or reported device from FastAPI
    hostPlatform: string;
    isGpuAvailable: boolean;
    vramUsedGb: number | null;
    vramTotalGb: number | null;
    ramUsedGb: number;
    ramTotalGb: number;
    sttModel: string;
    llmModel: string;
    ttsModel: string;
    modelReadiness: {
      stt: boolean;
      llm: boolean;
      tts: boolean;
    };
  };
}

export interface AppSettings {
  language: LanguageCode;
  autoDetectLanguage: boolean;
  selectedVoiceId: string;
  speechRate: number;           // 0.75 - 1.5
  selectedMicId: string;
  selectedSpeakerId: string;
  autoListen: boolean;          // Continuous conversational turn-taking
  bargeInEnabled: boolean;      // Interrupt assistant when user starts speaking
  vadSensitivity: number;       // 1 - 100
  apiBaseUrl: string;           // FastAPI base URL (e.g. http://localhost:8000)
  wsUrl: string;                // FastAPI WebSocket URL
  forcePreviewMode: boolean;    // Manually force offline preview mode
}

export interface BackendHealthStatus {
  online: boolean;
  version?: string;
  modelsLoaded?: {
    whisper: boolean;
    llm: boolean;
    tts: boolean;
  };
  compute?: {
    device?: string;
    platform?: string;
    gpu_available?: boolean;
    vram_allocated_gb?: number;
    vram_total_gb?: number;
    ram_used_gb?: number;
    ram_total_gb?: number;
  };
  latencyTestMs?: number;
  lastChecked: number;
  error?: string;
}
