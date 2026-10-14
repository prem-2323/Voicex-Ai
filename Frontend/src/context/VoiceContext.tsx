/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  VoiceState,
  Conversation,
  ChatMessage,
  AppSettings,
  PerformanceMetrics,
  BackendHealthStatus,
  LanguageCode,
} from '../types/voice';
import { DEFAULT_SETTINGS, INITIAL_METRICS_PREVIEW } from '../config/apiConfig';
import { voiceClient } from '../services/voiceClient';
import { audioManager } from '../services/audioManager';

export type TabScreen = 'workspace' | 'history' | 'performance' | 'settings';

interface VoiceContextType {
  voiceState: VoiceState;
  activeScreen: TabScreen;
  setActiveScreen: (screen: TabScreen) => void;
  conversations: Conversation[];
  activeConversation: Conversation | null;
  liveTranscript: { text: string; isFinal: boolean; language?: 'English' | 'Hindi' };
  liveStreamingText: string;
  metrics: PerformanceMetrics;
  settings: AppSettings;
  backendStatus: BackendHealthStatus;
  micVolume: number;
  isMuted: boolean;
  isMicAllowed: boolean;
  permissionError: string | null;
  // Methods
  startListening: () => Promise<void>;
  stopListeningAndProcess: () => Promise<void>;
  cancelTurn: () => void;
  sendTextMessage: (text: string) => Promise<void>;
  uploadAndProcessAudio: (audioFile: File) => Promise<void>;
  replayAssistantMessage: (text: string) => void;
  createNewConversation: () => void;
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
  renameConversation: (id: string, newTitle: string) => void;
  clearAllConversations: () => void;
  updateSettings: (newSettings: Partial<AppSettings>) => void;
  testBackendConnection: () => Promise<void>;
  toggleMute: () => void;
  setLiveTranscriptText: (text: string) => void;
  activeScenario: 'general' | 'support' | 'lead' | 'appointment';
  setScenario: (scenario: 'general' | 'support' | 'lead' | 'appointment') => void;
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined);

const SEED_CONVERSATIONS: Conversation[] = [
  {
    id: 'conv-seed-1',
    title: 'Edge Inference & Model Weights',
    createdAt: Date.now() - 3600000 * 2,
    updatedAt: Date.now() - 3600000 * 2,
    primaryLanguage: 'en',
    messages: [
      {
        id: 'seed-msg-1',
        role: 'user',
        content: 'What open-weight models power VoiceX AI locally?',
        detectedLanguage: 'English',
        timestamp: Date.now() - 3600000 * 2,
      },
      {
        id: 'seed-msg-2',
        role: 'assistant',
        content: 'VoiceX AI uses Whisper-v3-Turbo for ultra-fast speech-to-text, Llama-3.2-3B Instruct for intelligent low-latency reasoning, and Kokoro-82M for real-time neural speech synthesis.',
        detectedLanguage: 'English',
        timestamp: Date.now() - 3600000 * 2 + 1200,
        latencyMetrics: {
          sttMs: 132,
          ttftMs: 204,
          ttfaMs: 310,
          totalMs: 512,
          rtf: 0.16,
        },
      },
    ],
  },
  {
    id: 'conv-seed-2',
    title: 'Hindi Speech Recognition Test',
    createdAt: Date.now() - 3600000 * 24,
    updatedAt: Date.now() - 3600000 * 24,
    primaryLanguage: 'hi',
    messages: [
      {
        id: 'seed-msg-3',
        role: 'user',
        content: 'नमस्ते! क्या आप मुझे हिंदी में सहायता कर सकते हैं?',
        detectedLanguage: 'Hindi',
        timestamp: Date.now() - 3600000 * 24,
      },
      {
        id: 'seed-msg-4',
        role: 'assistant',
        content: 'नमस्ते! हाँ, मैं पूर्ण रूप से हिंदी में वार्तालाप कर सकता हूँ। आप किसी भी विषय पर मुझसे चर्चा कर सकते हैं।',
        detectedLanguage: 'Hindi',
        timestamp: Date.now() - 3600000 * 24 + 1100,
        latencyMetrics: {
          sttMs: 145,
          ttftMs: 218,
          ttfaMs: 340,
          totalMs: 545,
          rtf: 0.18,
        },
      },
    ],
  },
];

export const VoiceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [activeScreen, setActiveScreen] = useState<TabScreen>('workspace');
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const saved = localStorage.getItem('voicex_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const saved = localStorage.getItem('voicex_conversations');
      return saved ? JSON.parse(saved) : SEED_CONVERSATIONS;
    } catch {
      return SEED_CONVERSATIONS;
    }
  });

  const [activeConvId, setActiveConvId] = useState<string>(() => {
    return conversations[0]?.id || 'conv-default';
  });

  const [liveTranscript, setLiveTranscript] = useState<{
    text: string;
    isFinal: boolean;
    language?: 'English' | 'Hindi';
  }>({ text: '', isFinal: false });

  const [liveStreamingText, setLiveStreamingText] = useState<string>('');
  const [metrics, setMetrics] = useState<PerformanceMetrics>(INITIAL_METRICS_PREVIEW);
  const [micVolume, setMicVolume] = useState<number>(0);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isMicAllowed, setIsMicAllowed] = useState<boolean>(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [activeScenario, setScenario] = useState<'general' | 'support' | 'lead' | 'appointment'>('general');

  const [backendStatus, setBackendStatus] = useState<BackendHealthStatus>({
    online: false,
    lastChecked: Date.now(),
    error: 'Running in Preview Mode',
  });

  const animFrameRef = useRef<number | null>(null);
  const speechRecognitionRef = useRef<unknown>(null);

  // Sync settings & conversations to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('voicex_settings', JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem('voicex_conversations', JSON.stringify(conversations));
    } catch {
      // ignore
    }
  }, [conversations]);

  // Audio volume analyzer loop
  useEffect(() => {
    const updateAudioLevel = () => {
      const vol = audioManager.getVolumeLevel();
      setMicVolume(vol);
      animFrameRef.current = requestAnimationFrame(updateAudioLevel);
    };
    animFrameRef.current = requestAnimationFrame(updateAudioLevel);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Barge-in setup: when assistant speaks, user voice cancels audio and starts new turn
  useEffect(() => {
    if (settings.bargeInEnabled) {
      audioManager.setOnBargeIn(() => {
        handleBargeInInterruption();
      });
      audioManager.startBargeInDetector(0.35);
    } else {
      audioManager.stopBargeInDetector();
    }

    return () => {
      audioManager.stopBargeInDetector();
    };
  }, [settings.bargeInEnabled]);

  // Active conversation getter
  const activeConversation = conversations.find((c) => c.id === activeConvId) || conversations[0] || null;

  const testBackendConnection = useCallback(async () => {
    const result = await voiceClient.checkHealth(settings.apiBaseUrl);
    setBackendStatus(result);
    if (result.online && result.compute) {
      setMetrics((prev) => ({
        ...prev,
        isSimulatedPreview: false,
        deviceCompute: {
          deviceType: result.compute?.device || 'Host Engine',
          hostPlatform: result.compute?.platform || 'Local Host',
          isGpuAvailable: Boolean(result.compute?.gpu_available),
          vramUsedGb: result.compute?.vram_allocated_gb ?? null,
          vramTotalGb: result.compute?.vram_total_gb ?? null,
          ramUsedGb: result.compute?.ram_used_gb ?? 4.0,
          ramTotalGb: result.compute?.ram_total_gb ?? 16.0,
          sttModel: 'Whisper-v3-Turbo',
          llmModel: 'Llama-3.2-3B-Instruct',
          ttsModel: 'Kokoro-82M',
          modelReadiness: {
            stt: Boolean(result.modelsLoaded?.whisper),
            llm: Boolean(result.modelsLoaded?.llm),
            tts: Boolean(result.modelsLoaded?.tts),
          },
        },
      }));
    } else if (!result.online) {
      setMetrics((prev) => ({
        ...prev,
        isSimulatedPreview: true,
        deviceCompute: {
          ...prev.deviceCompute,
          deviceType: 'Unconnected (Preview Reference Baseline)',
          modelReadiness: {
            stt: false,
            llm: false,
            tts: false,
          },
        },
      }));
    }
  }, [settings.apiBaseUrl]);

  // Initial health check on mount
  useEffect(() => {
    testBackendConnection();
  }, [testBackendConnection]);

  const handleBargeInInterruption = () => {
    setVoiceState('interrupted');
    audioManager.stopSpeaking();
    voiceClient.cancelActiveResponse();

    // After brief visual snap, transition seamlessly into listening
    setTimeout(() => {
      setVoiceState('listening');
      setLiveTranscript({ text: '', isFinal: false });
      setLiveStreamingText('');
    }, 280);
  };

  const cancelTurn = useCallback(() => {
    voiceClient.cancelActiveResponse();
    audioManager.stopSpeaking();
    setVoiceState('idle');
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (next) audioManager.stopSpeaking();
      return next;
    });
  }, []);

  const createNewConversation = useCallback(() => {
    const newConv: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Voice Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      primaryLanguage: settings.language,
      messages: [],
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newConv.id);
    setLiveTranscript({ text: '', isFinal: false });
    setLiveStreamingText('');
    setVoiceState('idle');
  }, [settings.language]);

  const loadConversation = useCallback((id: string) => {
    setActiveConvId(id);
    setActiveScreen('workspace');
    setLiveTranscript({ text: '', isFinal: false });
    setLiveStreamingText('');
    setVoiceState('idle');
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations((prev) => {
      const filtered = prev.filter((c) => c.id !== id);
      if (filtered.length === 0) {
        const fresh: Conversation = {
          id: `conv-${Date.now()}`,
          title: 'New Voice Session',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          primaryLanguage: 'auto',
          messages: [],
        };
        return [fresh];
      }
      return filtered;
    });
  }, []);

  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, title: newTitle.trim() || c.title, updatedAt: Date.now() } : c))
    );
  }, []);

  const clearAllConversations = useCallback(() => {
    const fresh: Conversation = {
      id: `conv-${Date.now()}`,
      title: 'New Voice Session',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      primaryLanguage: 'auto',
      messages: [],
    };
    setConversations([fresh]);
    setActiveConvId(fresh.id);
    setLiveTranscript({ text: '', isFinal: false });
    setLiveStreamingText('');
  }, []);

  const updateSettings = useCallback((newSettings: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const replayAssistantMessage = useCallback((text: string) => {
    if (isMuted) return;
    setVoiceState('speaking');
    audioManager.speakViaBackend(text, {
      baseUrl: settings.apiBaseUrl,
      rate: settings.speechRate,
      onEnd: () => setVoiceState('idle'),
      onError: () => setVoiceState('idle'),
    });
  }, [isMuted, settings.apiBaseUrl, settings.speechRate]);

  // Start listening (Microphone)
  const startListening = useCallback(async () => {
    setPermissionError(null);
    audioManager.stopSpeaking();
    setLiveTranscript({ text: '', isFinal: false });
    setLiveStreamingText('');

    const micGranted = await audioManager.initMicrophone(settings.selectedMicId);
    if (!micGranted) {
      setIsMicAllowed(false);
      setPermissionError('Microphone access was denied or not supported in this browser. Please grant permissions or use quick text testing.');
      return;
    }

    setIsMicAllowed(true);
    setVoiceState('listening');

    // Optional browser SpeechRecognition integration for live transcript text preview
    const SpeechRec = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition ||
                      (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = settings.language === 'hi' ? 'hi-IN' : 'en-US';

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            interimTranscript += event.results[i][0].transcript;
          }
          if (interimTranscript) {
            const isHindi = /[\u0900-\u097F]/.test(interimTranscript);
            setLiveTranscript({
              text: interimTranscript,
              isFinal: false,
              language: isHindi ? 'Hindi' : 'English',
            });
          }
        };

        recognition.onerror = () => {
          // ignore soft speech recognition errors
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
      } catch {
        // Fallback to simulated audio listener
      }
    }
  }, [settings.selectedMicId, settings.language]);

  // Stop listening and run inference turn
  const stopListeningAndProcess = useCallback(async () => {
    if (speechRecognitionRef.current) {
      try {
        (speechRecognitionRef.current as any).stop();
      } catch {
        // ignore
      }
      speechRecognitionRef.current = null;
    }

    setVoiceState('transcribing');

    // Retrieve recorded audio blob from microphone
    const recordedBlob = await audioManager.stopRecording();
    audioManager.stopMicrophone();

    const fallbackText = liveTranscript.text.trim();
    await executeInferencePipeline({
      audioBlob: recordedBlob || undefined,
      promptText: fallbackText || undefined,
    });
  }, [liveTranscript.text]);

  // Audio file upload submission
  const uploadAndProcessAudio = useCallback(async (audioFile: File) => {
    setPermissionError(null);
    setVoiceState('transcribing');
    setLiveTranscript({ text: `Transcribing ${audioFile.name}...`, isFinal: false });
    await executeInferencePipeline({ audioBlob: audioFile });
  }, []);

  // Direct text prompt submission
  const sendTextMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setLiveTranscript({
      text: text.trim(),
      isFinal: true,
      language: /[\u0900-\u097F]/.test(text) ? 'Hindi' : 'English',
    });
    setVoiceState('thinking');
    await executeInferencePipeline({ promptText: text.trim() });
  }, []);

  const executeInferencePipeline = async (input: { audioBlob?: Blob; promptText?: string }) => {
    const activeConv = conversations.find((c) => c.id === activeConvId) || conversations[0];
    const historyPayload = (activeConv?.messages || []).slice(-10).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // If text prompt was directly provided, add user turn immediately
    if (input.promptText && !input.audioBlob) {
      const isHindi = /[\u0900-\u097F]/.test(input.promptText) || settings.language === 'hi';
      const detectedLang: 'English' | 'Hindi' = isHindi ? 'Hindi' : 'English';
      const userMsg: ChatMessage = {
        id: `msg-u-${Date.now()}`,
        role: 'user',
        content: input.promptText,
        detectedLanguage: detectedLang,
        timestamp: Date.now(),
      };

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === (activeConvId || prev[0]?.id)) {
            const updatedMessages = [...c.messages, userMsg];
            const newTitle = c.messages.length === 0 ? userMsg.content.slice(0, 32) : c.title;
            return { ...c, messages: updatedMessages, title: newTitle, updatedAt: Date.now() };
          }
          return c;
        })
      );
    }

    setVoiceState(input.audioBlob ? 'transcribing' : 'thinking');
    setLiveStreamingText('');

    let recordedUserMessageAdded = false;

    await voiceClient.processVoiceTurn(
      {
        audioBlob: input.audioBlob,
        transcriptHint: input.promptText,
        preferredLang: settings.language,
        baseUrl: settings.apiBaseUrl,
        wsUrl: settings.wsUrl,
        forcePreviewMode: settings.forcePreviewMode,
        sessionId: activeConvId || activeConv?.id,
        history: historyPayload,
      },
      {
        onTranscript: (t, isFin, lang) => {
          setLiveTranscript({ text: t, isFinal: isFin, language: lang });
          if (input.audioBlob && isFin && t.trim() && !recordedUserMessageAdded) {
            recordedUserMessageAdded = true;
            const userMsg: ChatMessage = {
              id: `msg-u-${Date.now()}`,
              role: 'user',
              content: t.trim(),
              detectedLanguage: lang || 'English',
              timestamp: Date.now(),
            };
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id === (activeConvId || prev[0]?.id)) {
                  const updatedMessages = [...c.messages, userMsg];
                  const newTitle = c.messages.length === 0 ? userMsg.content.slice(0, 32) : c.title;
                  return { ...c, messages: updatedMessages, title: newTitle, updatedAt: Date.now() };
                }
                return c;
              })
            );
          }
        },
        onToken: (_tok, accumulated) => {
          setVoiceState('speaking');
          setLiveStreamingText(accumulated);
        },
        onMetrics: (newMetrics) => {
          setMetrics(newMetrics);
        },
        onError: (err) => {
          setPermissionError(err);
          setVoiceState('idle');
        },
        onComplete: (assistantMsg) => {
          setConversations((prev) =>
            prev.map((c) => {
              if (c.id === (activeConvId || prev[0]?.id)) {
                return {
                  ...c,
                  messages: [...c.messages, assistantMsg],
                  updatedAt: Date.now(),
                };
              }
              return c;
            })
          );

          if (!isMuted) {
            setVoiceState('speaking');
            // Phase 5: play backend Edge-TTS audio, falling back to
            // local Web Speech synthesis when the TTS service is down.
            audioManager.speakViaBackend(assistantMsg.content, {
              baseUrl: settings.apiBaseUrl,
              voice: settings.selectedVoiceId,
              lang: assistantMsg.detectedLanguage === 'Hindi' ? 'hi' : 'en',
              rate: settings.speechRate,
              onEnd: () => {
                setVoiceState('idle');
                if (settings.autoListen) {
                  // Continuous conversation mode: start listening again
                  setTimeout(() => startListening(), 400);
                }
              },
              onError: () => {
                setVoiceState('idle');
              },
            });
          } else {
            setVoiceState('idle');
          }
        },
      }
    );
  };

  return (
    <VoiceContext.Provider
      value={{
        voiceState,
        activeScreen,
        setActiveScreen,
        conversations,
        activeConversation,
        liveTranscript,
        liveStreamingText,
        metrics,
        settings,
        backendStatus,
        micVolume,
        isMuted,
        isMicAllowed,
        permissionError,
        startListening,
        stopListeningAndProcess,
        cancelTurn,
        sendTextMessage,
        uploadAndProcessAudio,
        replayAssistantMessage,
        createNewConversation,
        loadConversation,
        deleteConversation,
        renameConversation,
        clearAllConversations,
        updateSettings,
        testBackendConnection,
        toggleMute,
        setLiveTranscriptText: (t) => setLiveTranscript((prev) => ({ ...prev, text: t })),
        activeScenario,
        setScenario,
      }}
    >
      {children}
    </VoiceContext.Provider>
  );
};

export const useVoice = () => {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error('useVoice must be used within a VoiceProvider');
  return ctx;
};
