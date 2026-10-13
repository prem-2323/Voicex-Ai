/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Volume2, VolumeX, RotateCcw, Square, Copy, Check, Sparkles } from 'lucide-react';
import { VoiceState, ChatMessage } from '../../types/voice';

interface StreamingResponseProps {
  streamingText: string;
  state: VoiceState;
  lastMessage: ChatMessage | null;
  isMuted: boolean;
  onReplay: (text: string) => void;
  onStopSpeaking: () => void;
  onToggleMute: () => void;
}

export const StreamingResponse: React.FC<StreamingResponseProps> = ({
  streamingText,
  state,
  lastMessage,
  isMuted,
  onReplay,
  onStopSpeaking,
  onToggleMute,
}) => {
  const [copied, setCopied] = useState(false);

  // Determine what text to show: live streaming text if active, or the last assistant message
  const displayText = streamingText || (lastMessage?.role === 'assistant' ? lastMessage.content : '');
  const isGenerating = state === 'thinking' || state === 'speaking';
  const isSpeaking = state === 'speaking';

  if (!displayText && !isGenerating) {
    return null;
  }

  const handleCopy = () => {
    if (!displayText) return;
    navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const metrics = lastMessage?.latencyMetrics;

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 px-4">
      <div className="bg-[#111827] border border-violet-500/20 rounded-xl p-5 shadow-xl transition-all">
        {/* Header metadata strip */}
        <div className="flex items-center justify-between pb-3 border-b border-white/5 text-xs text-[#94A3B8]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-violet-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>VoiceX Response</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{isSpeaking ? 'Speaking' : isGenerating ? 'Streaming...' : 'Complete'}</span>
            {metrics && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-cyan-400">
                  TTFA {metrics.ttfaMs}ms
                </span>
              </>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {isSpeaking && (
              <button
                onClick={onStopSpeaking}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-md transition-colors"
                title="Stop speaking"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>Stop</span>
              </button>
            )}

            <button
              onClick={onToggleMute}
              className={`p-1.5 rounded-md transition-colors ${
                isMuted
                  ? 'text-rose-400 bg-rose-500/10 hover:bg-rose-500/20'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
              title={isMuted ? 'Unmute voice' : 'Mute voice'}
              aria-label={isMuted ? 'Unmute assistant' : 'Mute assistant'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {displayText && !isSpeaking && (
              <button
                onClick={() => onReplay(displayText)}
                className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors rounded-md"
                title="Replay speech"
                aria-label="Replay speech audio"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}

            {displayText && (
              <button
                onClick={handleCopy}
                className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors rounded-md"
                title="Copy response"
                aria-label="Copy response text"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>

        {/* Content body with streaming cursor */}
        <div className="pt-3">
          {displayText ? (
            <p className="text-base text-[#F8FAFC] leading-relaxed whitespace-pre-wrap">
              {displayText}
              {isGenerating && (
                <span className="inline-block w-2 h-4 ml-1 bg-violet-400 animate-pulse align-middle" />
              )}
            </p>
          ) : (
            <div className="flex items-center gap-2 py-2 text-sm text-[#94A3B8]">
              <span className="inline-block w-2 h-2 rounded-full bg-violet-400 animate-ping" />
              <span>Thinking with local Llama-3.2-3B model...</span>
            </div>
          )}
        </div>

        {/* Footer timing bar if available */}
        {metrics && !isGenerating && (
          <div className="mt-3 pt-2.5 border-t border-white/5 flex flex-wrap items-center gap-3 text-[11px] text-[#94A3B8] font-mono tabular-nums">
            <span>STT: {metrics.sttMs}ms</span>
            <span aria-hidden="true">·</span>
            <span>TTFT: {metrics.ttftMs}ms</span>
            <span aria-hidden="true">·</span>
            <span>TTS RTF: {metrics.rtf}x</span>
            <span aria-hidden="true">·</span>
            <span className="text-emerald-400">Total: {metrics.totalMs}ms</span>
          </div>
        )}
      </div>
    </div>
  );
};
