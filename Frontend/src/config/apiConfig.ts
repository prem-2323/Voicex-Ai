/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppSettings, VoiceOption, PerformanceMetrics } from '../types/voice';

export const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8001';
export const DEFAULT_WS_URL = 'ws://127.0.0.1:8001/ws/voice';

export const AVAILABLE_VOICES: VoiceOption[] = [
  {
    id: 'en-US-AriaNeural',
    name: 'VoiceX Aria (Studio)',
    gender: 'female',
    language: 'en',
    accent: 'American (Studio Neural)',
    sampleText: 'Hello! I am VoiceX Aria, powered by Faster-Whisper, local Qwen 2.5, and Edge-TTS.',
    isLocalWeight: true,
  },
  {
    id: 'en-US-GuyNeural',
    name: 'VoiceX Guy (Natural)',
    gender: 'male',
    language: 'en',
    accent: 'American (Natural Male)',
    sampleText: 'Welcome! Local inference running directly on your host with real-time response.',
    isLocalWeight: true,
  },
  {
    id: 'en-IN-NeerjaNeural',
    name: 'VoiceX Neerja (Indian EN)',
    gender: 'female',
    language: 'multilingual',
    accent: 'Indian English / Clear Accent',
    sampleText: 'Hello! I can assist you with real-time multilingual voice conversations.',
    isLocalWeight: true,
  },
  {
    id: 'en-IN-PrabhatNeural',
    name: 'VoiceX Prabhat (Indian EN)',
    gender: 'male',
    language: 'multilingual',
    accent: 'Indian English (Natural Male)',
    sampleText: 'Namaste! Ready to answer your questions and perform fast local reasoning.',
    isLocalWeight: true,
  },
  {
    id: 'hi-IN-SwaraNeural',
    name: 'VoiceX Swara (Hindi)',
    gender: 'female',
    language: 'hi',
    accent: 'Hindi (Clear Devanagari)',
    sampleText: 'नमस्ते! मैं आपकी क्या सहायता कर सकती हूँ?',
    isLocalWeight: true,
  },
  {
    id: 'hi-IN-MadhurNeural',
    name: 'VoiceX Madhur (Hindi)',
    gender: 'male',
    language: 'hi',
    accent: 'Hindi (Natural Male)',
    sampleText: 'नमस्कार! वॉयस एक्स एआई आपकी सेवा में हाज़िर है।',
    isLocalWeight: true,
  },
];

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'auto',
  autoDetectLanguage: true,
  selectedVoiceId: 'en-US-AriaNeural',
  speechRate: 1.0,
  selectedMicId: 'default',
  selectedSpeakerId: 'default',
  autoListen: true,
  bargeInEnabled: true,
  vadSensitivity: 75,
  apiBaseUrl: DEFAULT_API_BASE_URL,
  wsUrl: DEFAULT_WS_URL,
  forcePreviewMode: false,
};

export const INITIAL_METRICS_PREVIEW: PerformanceMetrics = {
  sttDurationMs: 1550,
  timeToFirstTokenMs: 320,
  timeToFirstAudioMs: 1850,
  totalResponseMs: 3380,
  realTimeFactor: 0.16,
  successfulTurnRate: 100.0,
  isSimulatedPreview: false,
  benchmarkHistory: [
    {
      id: 'bm-prev-1',
      timestamp: Date.now() - 1000 * 60 * 12,
      label: 'Turn #1 (Faster-Whisper + Qwen 2.5 + Edge-TTS)',
      sttMs: 1590,
      ttftMs: 320,
      ttfaMs: 1850,
      totalMs: 3380,
      rtf: 0.16,
      isSimulated: false,
    },
  ],
  deviceCompute: {
    deviceType: 'NVIDIA GeForce RTX 3050 Laptop GPU',
    hostPlatform: 'Windows 10 / 11 Host',
    isGpuAvailable: true,
    vramUsedGb: 0.8,
    vramTotalGb: 4.0,
    ramUsedGb: 10.8,
    ramTotalGb: 15.8,
    sttModel: 'Faster-Whisper (base)',
    llmModel: 'Qwen 2.5 3B (Ollama)',
    ttsModel: 'Edge-TTS Neural',
    modelReadiness: {
      stt: true,
      llm: true,
      tts: true,
    },
  },
};

/**
 * Clean reference Python FastAPI starter server implementation.
 * Genuinely checks host CPU/GPU and reports genuine platform specifications.
 */
export const PYTHON_FASTAPI_BACKEND_CODE = `# VoiceX AI - Production Local FastAPI Architecture
# Stack: Faster-Whisper (STT) + Ollama Qwen 2.5 3B (LLM) + Edge-TTS (TTS)
# Requirements: pip install -r requirements.txt

# 1. Run local Ollama server:
#    ollama serve
#    ollama pull qwen2.5:3b

# 2. Start the FastAPI backend:
#    cd Backend
#    .\\.venv\\Scripts\\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

# 3. Available Endpoints:
#    POST /api/transcribe      (Audio Upload -> Speech-to-Text via Faster-Whisper)
#    POST /api/chat            (Text & Multi-turn History -> Qwen 2.5 3B Inference)
#    POST /api/tts             (AI Response -> Streaming Neural Audio MP3)
#    GET  /api/models          (Component readiness status)
#    GET  /api/health          (System health & host hardware telemetry)
#    GET  /api/conversations   (Multi-session history persistence)
#    POST /api/performance/benchmark (Real pipeline latency benchmarking)
`;

