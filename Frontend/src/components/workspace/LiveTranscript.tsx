/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Copy, Check, Globe } from 'lucide-react';

interface LiveTranscriptProps {
  transcript: string;
  isFinal: boolean;
  detectedLanguage?: 'English' | 'Hindi';
  isListening: boolean;
}

export const LiveTranscript: React.FC<LiveTranscriptProps> = ({
  transcript,
  isFinal,
  detectedLanguage = 'English',
  isListening,
}) => {
  const [copied, setCopied] = useState(false);

  if (!transcript && !isListening) {
    return null;
  }

  const handleCopy = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-2xl mx-auto mt-4 px-4">
      <div className="bg-[#111827]/80 border border-white/10 rounded-xl p-4 transition-all">
        {/* Top metadata strip */}
        <div className="flex items-center justify-between text-xs text-[#94A3B8] pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[#22D3EE] font-medium">
              <Globe className="w-3.5 h-3.5" />
              <span>{detectedLanguage}</span>
            </span>
            <span aria-hidden="true">·</span>
            <span>{isFinal ? 'Transcribed' : isListening ? 'Listening input...' : 'Processing'}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">Faster-Whisper</span>
          </div>

          {transcript && (
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 text-[#94A3B8] hover:text-[#F8FAFC] transition-colors p-1 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-400"
              title="Copy transcript"
              aria-label="Copy user transcript"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>

        {/* Content utterance */}
        <div className="pt-3">
          {transcript ? (
            <p className="text-base text-[#F8FAFC] leading-relaxed font-normal">
              "{transcript}"
              {!isFinal && isListening && (
                <span className="inline-block w-2 h-4 ml-1 bg-[#22D3EE] animate-pulse align-middle" />
              )}
            </p>
          ) : (
            <p className="text-sm text-[#94A3B8] italic flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-[#22D3EE] animate-ping" />
              Listening to microphone... Speak in English or Hindi
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
