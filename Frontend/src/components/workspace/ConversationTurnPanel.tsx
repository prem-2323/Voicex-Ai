/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Square,
  Copy,
  Check,
  Globe,
  Sparkles,
} from 'lucide-react';
import { VoiceState, ChatMessage } from '../../types/voice';

interface ConversationTurnPanelProps {
  transcript: string;
  isFinalTranscript: boolean;
  detectedLang?: 'English' | 'Hindi';
  streamingText: string;
  voiceState: VoiceState;
  lastUserMessage: ChatMessage | null;
  lastAssistantMessage: ChatMessage | null;
  isMuted: boolean;
  onReplay: (text: string) => void;
  onStopSpeaking: () => void;
  onToggleMute: () => void;
  onSelectPrompt: (prompt: string) => void;
}

export const ConversationTurnPanel: React.FC<ConversationTurnPanelProps> = ({
  transcript,
  isFinalTranscript,
  detectedLang,
  streamingText,
  voiceState,
  lastUserMessage,
  lastAssistantMessage,
  isMuted,
  onReplay,
  onStopSpeaking,
  onToggleMute,
  onSelectPrompt,
}) => {
  const [copiedUser, setCopiedUser] = useState(false);
  const [copiedAssistant, setCopiedAssistant] = useState(false);

  // User utterance text: either current live transcript or last user message
  const userText = transcript || lastUserMessage?.content || '';
  const activeUserLang = detectedLang || lastUserMessage?.detectedLanguage || 'English';

  // Assistant response text
  const assistantText = streamingText || lastAssistantMessage?.content || '';
  const isGenerating = voiceState === 'thinking' || voiceState === 'speaking';
  const isSpeaking = voiceState === 'speaking';
  const metrics = lastAssistantMessage?.latencyMetrics;

  const samplePrompts = [
    { label: 'Latency benchmarks', text: 'Explain how VoiceX AI achieves sub-second local latency.' },
    { label: 'हिंदी में बोलें', text: 'नमस्ते! क्या आप मुझे हिंदी में इस वॉयस मॉडल के बारे में बता सकते हैं?' },
    { label: 'Loaded model weights', text: 'What open-weight models are loaded for this inference pipeline?' },
  ];

  const handleCopyUser = () => {
    if (!userText) return;
    navigator.clipboard.writeText(userText);
    setCopiedUser(true);
    setTimeout(() => setCopiedUser(false), 1500);
  };

  const handleCopyAssistant = () => {
    if (!assistantText) return;
    navigator.clipboard.writeText(assistantText);
    setCopiedAssistant(true);
    setTimeout(() => setCopiedAssistant(false), 1500);
  };

  // If no activity yet, show compact prompt suggestions
  if (!userText && !assistantText && !isGenerating) {
    return (
      <div className="w-full max-w-xl mx-auto px-4 py-2">
        <div className="p-3 bg-[#141C2B] border border-[#273247] rounded-lg">
          <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#8B5CF6]" />
            <span>Suggested prompts to speak or click:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {samplePrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => onSelectPrompt(p.text)}
                className="px-2.5 py-1 rounded bg-[#192335] hover:bg-[#202c42] border border-[#273247] text-xs text-[#F1F5F9] transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto px-4 py-1 space-y-2 text-xs">
      {/* 1. User Message / Transcript Card */}
      {userText && (
        <div className="bg-[#141C2B] border border-[#273247] rounded-lg p-2.5 transition-all">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#273247]/60 text-[11px] text-[#94A3B8]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#F1F5F9]">You</span>
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 text-[#22D3EE]">
                <Globe className="w-3 h-3" />
                <span>{activeUserLang}</span>
              </span>
              {!isFinalTranscript && voiceState === 'listening' && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-amber-400">Live recording</span>
                </>
              )}
            </div>

            <button
              onClick={handleCopyUser}
              className="p-0.5 text-[#94A3B8] hover:text-[#F1F5F9] transition-colors"
              title="Copy transcript"
              aria-label="Copy user transcript"
            >
              {copiedUser ? <Check className="w-3 h-3 text-[#22C55E]" /> : <Copy className="w-3 h-3" />}
            </button>
          </div>

          <div className="pt-1.5 text-xs text-[#F1F5F9] leading-relaxed">
            {userText}
            {!isFinalTranscript && voiceState === 'listening' && (
              <span className="inline-block w-1.5 h-3 ml-1 bg-[#22D3EE] animate-pulse align-middle" />
            )}
          </div>
        </div>
      )}

      {/* 2. Assistant Response Card */}
      {(assistantText || isGenerating) && (
        <div className="bg-[#192335] border border-[#273247] rounded-lg p-2.5 transition-all">
          <div className="flex items-center justify-between pb-1.5 border-b border-[#273247]/60 text-[11px] text-[#94A3B8]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[#8B5CF6]">VoiceX AI</span>
              <span aria-hidden="true">·</span>
              <span>{isSpeaking ? 'Speaking' : isGenerating ? 'Streaming...' : 'Complete'}</span>
              {metrics && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums text-[#22D3EE]">
                    TTFA {metrics.ttfaMs}ms
                  </span>
                </>
              )}
            </div>

            {/* Assistant Controls */}
            <div className="flex items-center gap-1">
              {isSpeaking && (
                <button
                  onClick={onStopSpeaking}
                  className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded transition-colors"
                  title="Stop speaking (barge-in)"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  <span>Stop</span>
                </button>
              )}

              <button
                onClick={onToggleMute}
                className={`p-1 rounded transition-colors ${
                  isMuted ? 'text-rose-400 bg-rose-500/10' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
                title={isMuted ? 'Unmute voice' : 'Mute voice'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {assistantText && !isSpeaking && (
                <button
                  onClick={() => onReplay(assistantText)}
                  className="p-1 text-[#94A3B8] hover:text-[#F1F5F9] transition-colors rounded"
                  title="Replay audio"
                  aria-label="Replay audio"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              {assistantText && (
                <button
                  onClick={handleCopyAssistant}
                  className="p-1 text-[#94A3B8] hover:text-[#F1F5F9] transition-colors rounded"
                  title="Copy response"
                  aria-label="Copy response text"
                >
                  {copiedAssistant ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>

          <div className="pt-1.5 text-xs text-[#F1F5F9] leading-relaxed whitespace-pre-wrap">
            {assistantText ? (
              <>
                {assistantText}
                {isGenerating && (
                  <span className="inline-block w-1.5 h-3 ml-1 bg-[#8B5CF6] animate-pulse align-middle" />
                )}
              </>
            ) : (
              <span className="text-[#94A3B8] italic flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] animate-ping" />
                <span>Processing turn on local model pipeline...</span>
              </span>
            )}
          </div>

          {/* Compact Telemetry strip if turn is completed */}
          {metrics && !isGenerating && (
            <div className="mt-2 pt-1.5 border-t border-[#273247]/60 flex flex-wrap items-center gap-2.5 text-[10px] text-[#94A3B8] font-mono tabular-nums">
              <span>STT: {metrics.sttMs}ms</span>
              <span aria-hidden="true">·</span>
              <span>TTFT: {metrics.ttftMs}ms</span>
              <span aria-hidden="true">·</span>
              <span>TTS: {metrics.rtf}x RTF</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#22C55E]">Total: {metrics.totalMs}ms</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
