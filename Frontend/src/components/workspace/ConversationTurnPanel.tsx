/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  VolumeX,
  RotateCcw,
  Square,
  Copy,
  Check,
  Globe,
  Send,
} from 'lucide-react';
import { VoiceState, ChatMessage } from '../../types/voice';
import { VoiceXLogo } from '../brand/VoiceXLogo';

interface ConversationTurnPanelProps {
  transcript: string;
  isFinalTranscript: boolean;
  detectedLang?: 'English' | 'Hindi';
  streamingText: string;
  voiceState: VoiceState;
  lastUserMessage: ChatMessage | null;
  lastAssistantMessage: ChatMessage | null;
  messages?: ChatMessage[];
  isMuted: boolean;
  onReplay: (text: string) => void;
  onStopSpeaking: () => void;
  onToggleMute: () => void;
  onSelectPrompt: (prompt: string) => void;
  textInputValue?: string;
  onTextInputChange?: (value: string) => void;
  onTextSubmit?: (e: React.FormEvent) => void;
}

export const ConversationTurnPanel: React.FC<ConversationTurnPanelProps> = ({
  transcript,
  isFinalTranscript,
  detectedLang,
  streamingText,
  voiceState,
  lastUserMessage,
  lastAssistantMessage,
  messages = [],
  isMuted,
  onReplay,
  onStopSpeaking,
  onToggleMute,
  onSelectPrompt,
  textInputValue = '',
  onTextInputChange,
  onTextSubmit,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const samplePrompts = [
    { label: 'Latency benchmarks', text: 'Explain how VoiceX AI achieves sub-second local latency.' },
    { label: 'हिंदी में बोलें', text: 'नमस्ते! क्या आप मुझे हिंदी में इस वॉयस मॉडल के बारे में बता सकते हैं?' },
    { label: 'Loaded model weights', text: 'What open-weight models are loaded for this inference pipeline?' },
  ];

  const isGenerating = voiceState === 'thinking' || voiceState === 'speaking';
  const isSpeaking = voiceState === 'speaking';

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Auto-scroll purely inside message container when content changes (never scroll window)
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [messages, transcript, streamingText]);

  // Determine if active turn has completed in messages
  const lastMessage = messages[messages.length - 1];
  const hasLiveUserTurn = voiceState === 'listening' && Boolean(transcript);
  const hasLiveAssistantTurn =
    isGenerating && (!lastMessage || lastMessage.role !== 'assistant');

  // Fallback if messages array is empty but last messages exist
  const displayMessages =
    messages.length > 0
      ? messages
      : [
          ...(lastUserMessage ? [lastUserMessage] : []),
          ...(lastAssistantMessage ? [lastAssistantMessage] : []),
        ];

  const isEmpty =
    displayMessages.length === 0 && !hasLiveUserTurn && !hasLiveAssistantTurn && !streamingText;

  return (
    <div className="w-full h-full glass-panel rounded-2xl p-3.5 md:p-4 border border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.35)] flex flex-col justify-between min-h-0 overflow-hidden relative">
      {/* 1. Top Pinned Section: Suggested Prompts */}
      <div className="shrink-0 pb-3 border-b border-white/10 select-none">
        <div className="flex items-center gap-1.5 text-xs text-[#94A3B8] mb-2">
          <span className="font-semibold text-slate-200 text-xs">
            Suggested prompts to speak or click:
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {samplePrompts.map((p, idx) => (
            <button
              key={idx}
              onClick={() => onSelectPrompt(p.text)}
              className="px-3 py-1.5 rounded-lg glass-button text-xs text-[#F1F5F9] transition-all hover:text-white hover:border-violet-400/50 hover:bg-violet-600/20 active:scale-95"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. Middle Scrollable Conversation Stream Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3 py-3 pr-1 select-text"
      >
        {isEmpty ? (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center rounded-xl border border-dashed border-white/10 bg-slate-900/20">
            <div className="mb-4 rounded-2xl shadow-lg shadow-violet-900/30">
              <VoiceXLogo size={52} />
            </div>
            <h3 className="text-sm font-semibold text-[#F1F5F9] mb-1">
              Real-Time Conversation Stream
            </h3>
            <p className="text-xs text-[#94A3B8] max-w-sm leading-relaxed">
              Spoken transcripts and AI voice replies will stream here live with sub-second latency.
              Click any suggested prompt above or tap the Talk button on the left to start!
            </p>
          </div>
        ) : (
          <>
            {/* Completed Messages */}
            {displayMessages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <div
                    key={msg.id}
                    className="glass-panel rounded-xl p-3 border border-white/10 bg-slate-900/40 shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[11px] text-[#94A3B8]">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#F1F5F9]">You</span>
                        <span aria-hidden="true" className="opacity-40">
                          ·
                        </span>
                        <span className="flex items-center gap-1 text-[#22D3EE] font-medium">
                          <Globe className="w-3 h-3" />
                          <span>{msg.detectedLanguage || 'English'}</span>
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="p-1 text-[#94A3B8] hover:text-[#F1F5F9] glass-pill rounded-md transition-colors"
                        title="Copy message"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3 h-3 text-[#22C55E]" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <div className="pt-2 text-xs md:text-sm text-[#F1F5F9] leading-relaxed">
                      {msg.content}
                    </div>
                  </div>
                );
              }

              // Assistant message
              const isCurrentlySpeakingThis =
                isSpeaking && displayMessages[displayMessages.length - 1]?.id === msg.id;

              return (
                <div
                  key={msg.id}
                  className="glass-panel rounded-xl p-3.5 border border-violet-500/30 bg-slate-900/60 shadow-[0_4px_20px_rgba(139,92,246,0.15)] transition-all"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[11px] text-[#94A3B8]">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[#8B5CF6]">VoiceX AI</span>
                      <span aria-hidden="true" className="opacity-40">
                        ·
                      </span>
                      <span className="text-violet-300 font-medium">
                        {isCurrentlySpeakingThis ? 'Speaking' : 'Complete'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isCurrentlySpeakingThis && (
                        <button
                          onClick={onStopSpeaking}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md transition-colors"
                          title="Stop speaking (barge-in)"
                        >
                          <Square className="w-2.5 h-2.5 fill-current" />
                          <span>Stop</span>
                        </button>
                      )}

                      <button
                        onClick={onToggleMute}
                        className={`p-1 rounded-md glass-pill transition-colors ${
                          isMuted
                            ? 'text-rose-400 border-rose-500/30 bg-rose-500/10'
                            : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                        }`}
                        title={isMuted ? 'Unmute voice' : 'Mute voice'}
                      >
                        {isMuted ? (
                          <VolumeX className="w-3.5 h-3.5" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      <button
                        onClick={() => onReplay(msg.content)}
                        className="p-1 text-[#94A3B8] hover:text-[#F1F5F9] transition-colors rounded-md glass-pill"
                        title="Replay audio"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleCopy(msg.content, msg.id)}
                        className="p-1 text-[#94A3B8] hover:text-[#F1F5F9] transition-colors rounded-md glass-pill"
                        title="Copy response"
                      >
                        {copiedId === msg.id ? (
                          <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 text-xs md:text-sm text-[#F1F5F9] leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Live User Utterance (Recording in progress) */}
            {hasLiveUserTurn && (
              <div className="glass-panel rounded-xl p-3 border border-cyan-400/40 bg-cyan-950/20 shadow-[0_0_20px_rgba(34,211,238,0.15)] transition-all">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[11px] text-[#94A3B8]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#F1F5F9]">You</span>
                    <span aria-hidden="true" className="opacity-40">
                      ·
                    </span>
                    <span className="flex items-center gap-1 text-[#22D3EE] font-medium">
                      <Globe className="w-3 h-3" />
                      <span>{detectedLang || 'English'}</span>
                    </span>
                    <span aria-hidden="true" className="opacity-40">
                      ·
                    </span>
                    <span className="text-cyan-300 font-medium animate-pulse flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                      Live recording
                    </span>
                  </div>
                </div>
                <div className="pt-2 text-xs md:text-sm text-[#F1F5F9] leading-relaxed">
                  {transcript}
                  {!isFinalTranscript && (
                    <span className="inline-block w-1.5 h-3 ml-1 bg-[#22D3EE] animate-pulse align-middle" />
                  )}
                </div>
              </div>
            )}

            {/* Live Assistant Response (Streaming tokens or synthesizing) */}
            {hasLiveAssistantTurn && (
              <div className="glass-panel rounded-xl p-3.5 border border-violet-500/40 bg-slate-900/70 shadow-[0_4px_25px_rgba(139,92,246,0.2)] transition-all">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/10 text-[11px] text-[#94A3B8]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#8B5CF6]">VoiceX AI</span>
                    <span aria-hidden="true" className="opacity-40">
                      ·
                    </span>
                    <span className="text-violet-300 font-medium">
                      {voiceState === 'speaking' ? 'Speaking' : 'Thinking...'}
                    </span>
                  </div>

                  {voiceState === 'speaking' && (
                    <button
                      onClick={onStopSpeaking}
                      className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-md transition-colors"
                      title="Stop speaking (barge-in)"
                    >
                      <Square className="w-2.5 h-2.5 fill-current" />
                      <span>Stop</span>
                    </button>
                  )}
                </div>

                <div className="pt-2 text-xs md:text-sm text-[#F1F5F9] leading-relaxed whitespace-pre-wrap">
                  {streamingText ? (
                    <>
                      {streamingText}
                      <span className="inline-block w-1.5 h-3.5 ml-1 bg-[#8B5CF6] animate-pulse align-middle" />
                    </>
                  ) : (
                    <span className="text-[#94A3B8] italic flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-ping" />
                      <span>Synthesizing response with sub-second latency...</span>
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 3. Bottom Pinned Section: Integrated Text Input */}
      {onTextSubmit && (
        <form
          onSubmit={onTextSubmit}
          className="shrink-0 pt-2.5 border-t border-white/10 flex items-center gap-2"
        >
          <input
            type="text"
            value={textInputValue}
            onChange={(e) => onTextInputChange?.(e.target.value)}
            placeholder="Type message in English or हिन्दी (or speak on the left)..."
            className="flex-1 glass-card rounded-xl px-3.5 py-2 text-xs text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:outline-none focus:border-violet-500 border border-white/10 transition-colors"
          />
          <button
            type="submit"
            disabled={!textInputValue.trim()}
            className="px-4 py-2 glass-button bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      )}
    </div>
  );
};
