/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Mic,
  Volume2,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Play,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { AVAILABLE_VOICES } from '../../config/apiConfig';
import { audioManager, AudioDevice } from '../../services/audioManager';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    backendStatus,
    testBackendConnection,
    clearAllConversations,
    conversations,
  } = useVoice();

  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [isPingingBackend, setIsPingingBackend] = useState(false);
  const [connectionFeedback, setConnectionFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string | null;
  }>({ type: null, message: null });

  // Enumerate hardware devices
  useEffect(() => {
    const loadDevices = async () => {
      const dev = await audioManager.getAvailableDevices();
      setInputDevices(dev.inputs);
      setOutputDevices(dev.outputs);
    };
    loadDevices();
  }, []);

  const handleTestVoice = async (sampleText: string, voiceId?: string) => {
    setIsTestingVoice(true);
    try {
      if (backendStatus.online) {
        await audioManager.speakViaBackend(sampleText, {
          voice: voiceId || settings.selectedVoiceId,
          baseUrl: settings.apiBaseUrl,
        });
      } else {
        audioManager.speak(sampleText, {
          rate: settings.speechRate,
          onEnd: () => setIsTestingVoice(false),
          onError: () => setIsTestingVoice(false),
        });
      }
    } catch {
      audioManager.speak(sampleText, {
        rate: settings.speechRate,
        onEnd: () => setIsTestingVoice(false),
        onError: () => setIsTestingVoice(false),
      });
    } finally {
      setIsTestingVoice(false);
    }
  };

  const handlePingBackend = async () => {
    setIsPingingBackend(true);
    setConnectionFeedback({ type: null, message: null });
    await testBackendConnection();
    setIsPingingBackend(false);

    if (backendStatus.online) {
      setConnectionFeedback({
        type: 'success',
        message: `Successfully reached local backend at ${settings.apiBaseUrl} (Latency: ${backendStatus.latencyTestMs || 12}ms).`,
      });
    } else {
      setConnectionFeedback({
        type: 'error',
        message: `Could not reach ${settings.apiBaseUrl}/health. Ensure your local Python FastAPI server is running.`,
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-4xl mx-auto w-full bg-[#0B0F17]">
      {/* Header bar */}
      <div className="pb-4 border-b border-[#273247]">
        <h2 className="text-lg md:text-xl font-bold text-[#F1F5F9]">Settings</h2>
        <p className="text-xs text-[#94A3B8] mt-0.5">
          Configure multilingual speech synthesis, hardware routing, conversational turn-taking, and local backend endpoints.
        </p>
      </div>

      <div className="mt-5 space-y-4">
        {/* Section A: Language and Voice */}
        <div className="bg-[#141C2B] border border-[#273247] rounded-lg p-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#273247]/60">
            <Globe className="w-4 h-4 text-[#22D3EE]" />
            <h3 className="font-semibold text-[#F1F5F9]">A. Language and Voice</h3>
          </div>

          <div className="mt-4 space-y-4">
            {/* Language Selection */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <label className="font-medium text-[#F1F5F9] block">
                  Primary Interaction Language
                </label>
                <p className="text-[11px] text-[#94A3B8]">
                  Select preferred interaction language or use automated dialect detection.
                </p>
              </div>

              <div className="flex items-center bg-[#0E1420] border border-[#273247] rounded-md p-0.5 text-xs">
                <button
                  onClick={() => updateSettings({ language: 'auto' })}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    settings.language === 'auto'
                      ? 'bg-[#8B5CF6] text-white'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  Auto-Detect
                </button>
                <button
                  onClick={() => updateSettings({ language: 'en' })}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    settings.language === 'en'
                      ? 'bg-[#8B5CF6] text-white'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  English
                </button>
                <button
                  onClick={() => updateSettings({ language: 'hi' })}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                    settings.language === 'hi'
                      ? 'bg-[#8B5CF6] text-white'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  हिन्दी (Hindi)
                </button>
              </div>
            </div>

            {/* Neural TTS Voice Selector */}
            <div className="pt-3 border-t border-[#273247]/60">
              <label className="font-medium text-[#F1F5F9] block mb-1">
                Supported Neural TTS Voice
              </label>
              <p className="text-[11px] text-[#94A3B8] mb-2.5">
                FastAPI Edge-TTS neural speech voices across English & Hindi.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {AVAILABLE_VOICES.map((voice) => {
                  const isSelected = settings.selectedVoiceId === voice.id;
                  return (
                    <div
                      key={voice.id}
                      onClick={() => updateSettings({ selectedVoiceId: voice.id })}
                      className={`p-2.5 rounded-md border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#192335] border-[#8B5CF6] text-[#F1F5F9]'
                          : 'bg-[#0E1420] border-[#273247] text-[#94A3B8] hover:border-[#384763]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-[#F1F5F9]">{voice.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestVoice(voice.sampleText, voice.id);
                          }}
                          disabled={isTestingVoice}
                          className="px-1.5 py-0.5 rounded bg-[#141C2B] hover:bg-[#202c42] text-[#22D3EE] text-[10px] flex items-center gap-1 border border-[#273247]"
                          title="Preview voice"
                        >
                          <Play className="w-2.5 h-2.5 fill-current" />
                          <span>Preview</span>
                        </button>
                      </div>
                      <p className="text-[10px] text-[#94A3B8] mt-0.5">{voice.accent}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Speech Speed Control */}
            <div className="pt-3 border-t border-[#273247]/60">
              <div className="flex justify-between items-center mb-1 text-xs">
                <span className="font-medium text-[#F1F5F9]">Speech Velocity</span>
                <span className="font-mono text-[#22D3EE] tabular-nums">{settings.speechRate}x</span>
              </div>
              <input
                type="range"
                min="0.75"
                max="1.5"
                step="0.05"
                value={settings.speechRate}
                onChange={(e) => updateSettings({ speechRate: parseFloat(e.target.value) })}
                className="w-full h-1 bg-[#0E1420] rounded-lg appearance-none cursor-pointer accent-[#8B5CF6]"
              />
              <div className="flex justify-between text-[10px] text-[#94A3B8] mt-1 font-mono">
                <span>0.75x</span>
                <span>1.0x (Default)</span>
                <span>1.5x</span>
              </div>
            </div>
          </div>
        </div>

        {/* Section B: Microphone and Speaker */}
        <div className="bg-[#141C2B] border border-[#273247] rounded-lg p-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#273247]/60">
            <Mic className="w-4 h-4 text-[#8B5CF6]" />
            <h3 className="font-semibold text-[#F1F5F9]">B. Microphone and Speaker</h3>
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="font-medium text-[#F1F5F9] block mb-1">
                Microphone Input Device
              </label>
              <select
                value={settings.selectedMicId}
                onChange={(e) => updateSettings({ selectedMicId: e.target.value })}
                className="w-full bg-[#0E1420] border border-[#273247] rounded-md p-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#8B5CF6]"
              >
                <option value="default">System Default Input</option>
                {inputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-medium text-[#F1F5F9] block mb-1">
                Speaker Output Device
              </label>
              <select
                value={settings.selectedSpeakerId}
                onChange={(e) => updateSettings({ selectedSpeakerId: e.target.value })}
                className="w-full bg-[#0E1420] border border-[#273247] rounded-md p-2 text-xs text-[#F1F5F9] focus:outline-none focus:border-[#8B5CF6]"
              >
                <option value="default">System Default Output</option>
                {outputDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || `Speaker ${d.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Section C: Interaction and Turn-Taking */}
        <div className="bg-[#141C2B] border border-[#273247] rounded-lg p-4 text-xs">
          <div className="flex items-center gap-2 pb-3 border-b border-[#273247]/60">
            <Volume2 className="w-4 h-4 text-[#22D3EE]" />
            <h3 className="font-semibold text-[#F1F5F9]">C. Interaction and Turn-Taking</h3>
          </div>

          <div className="mt-4 space-y-3">
            {/* Barge-In Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[#F1F5F9]">Barge-In Interruption</p>
                <p className="text-[11px] text-[#94A3B8]">
                  Instantly abort assistant speech when user starts talking.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.bargeInEnabled}
                onChange={(e) => updateSettings({ bargeInEnabled: e.target.checked })}
                className="w-4 h-4 accent-[#8B5CF6] rounded cursor-pointer"
              />
            </div>

            {/* Auto-Listen Toggle */}
            <div className="flex items-center justify-between pt-2.5 border-t border-[#273247]/60">
              <div>
                <p className="font-medium text-[#F1F5F9]">Continuous Auto-Listen</p>
                <p className="text-[11px] text-[#94A3B8]">
                  Automatically re-arm microphone after the assistant finishes speaking.
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoListen}
                onChange={(e) => updateSettings({ autoListen: e.target.checked })}
                className="w-4 h-4 accent-[#8B5CF6] rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Section D: Local Backend and Privacy */}
        <div className="bg-[#141C2B] border border-[#273247] rounded-lg p-4 text-xs">
          <div className="flex items-center justify-between pb-3 border-b border-[#273247]/60">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#22C55E]" />
              <h3 className="font-semibold text-[#F1F5F9]">D. Local Backend and Privacy</h3>
            </div>
            {backendStatus.online ? (
              <span className="text-[11px] text-[#22C55E] flex items-center gap-1 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#22D3EE] font-medium">
                Preview Mode Active
              </span>
            )}
          </div>

          <div className="mt-4 space-y-3">
            <div>
              <label className="font-medium text-[#F1F5F9] block mb-1">
                FastAPI Base URL
              </label>
              <input
                type="text"
                value={settings.apiBaseUrl}
                onChange={(e) => updateSettings({ apiBaseUrl: e.target.value })}
                placeholder="http://localhost:8000"
                className="w-full bg-[#0E1420] border border-[#273247] rounded-md p-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div>
              <label className="font-medium text-[#F1F5F9] block mb-1">
                WebSocket Streaming URL
              </label>
              <input
                type="text"
                value={settings.wsUrl}
                onChange={(e) => updateSettings({ wsUrl: e.target.value })}
                placeholder="ws://localhost:8000/ws/voice"
                className="w-full bg-[#0E1420] border border-[#273247] rounded-md p-2 text-xs text-[#F1F5F9] font-mono focus:outline-none focus:border-[#8B5CF6]"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handlePingBackend}
                disabled={isPingingBackend}
                className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-50 text-white rounded-md font-medium flex items-center gap-1.5 transition-colors text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isPingingBackend ? 'animate-spin' : ''}`} />
                <span>Test Connection</span>
              </button>

              <label className="flex items-center gap-2 cursor-pointer text-[#94A3B8] text-[11px]">
                <input
                  type="checkbox"
                  checked={settings.forcePreviewMode}
                  onChange={(e) => updateSettings({ forcePreviewMode: e.target.checked })}
                  className="w-3.5 h-3.5 accent-[#8B5CF6] rounded"
                />
                <span>Force Offline Preview</span>
              </label>
            </div>

            {/* Connection feedback message */}
            {connectionFeedback.message && (
              <div
                className={`p-2.5 rounded-md flex items-start gap-2 text-xs ${
                  connectionFeedback.type === 'success'
                    ? 'bg-[#22C55E]/10 border border-[#22C55E]/20 text-[#22C55E]'
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-300'
                }`}
              >
                {connectionFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
                )}
                <span>{connectionFeedback.message}</span>
              </div>
            )}

            {/* Privacy & Storage Wipe */}
            <div className="pt-3 border-t border-[#273247]/60 flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-[#94A3B8]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E]" />
                <span>{conversations.length} sessions stored locally in browser storage.</span>
              </div>

              <button
                onClick={clearAllConversations}
                className="px-2.5 py-1 text-xs text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-md transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Local Data</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
