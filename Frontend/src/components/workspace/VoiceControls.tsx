/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Square, Send, Globe, ChevronDown, AlertCircle } from 'lucide-react';
import { VoiceState, LanguageCode } from '../../types/voice';
import { AVAILABLE_VOICES } from '../../config/apiConfig';

interface VoiceControlsProps {
  state: VoiceState;
  selectedLanguage: LanguageCode;
  selectedVoiceId: string;
  permissionError: string | null;
  onStartListening: () => void;
  onStopListening: () => void;
  onCancel: () => void;
  onSelectLanguage: (lang: LanguageCode) => void;
  onSelectVoice: (voiceId: string) => void;
  onSendTextMessage: (text: string) => void;
}

export const VoiceControls: React.FC<VoiceControlsProps> = ({
  state,
  selectedLanguage,
  selectedVoiceId,
  permissionError,
  onStartListening,
  onStopListening,
  onCancel,
  onSelectLanguage,
  onSelectVoice,
  onSendTextMessage,
}) => {
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);

  // Global keyboard shortcuts (Space / M for mic, Esc for cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is actively typing in an input or textarea
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        if (e.key === 'Escape') {
          onCancel();
        }
        return;
      }

      if (e.code === 'Space' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (state === 'listening') {
          onStopListening();
        } else if (state === 'idle') {
          onStartListening();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [state, onStartListening, onStopListening, onCancel]);

  const handleMicClick = () => {
    if (state === 'listening') {
      onStopListening();
    } else if (state === 'speaking' || state === 'thinking') {
      onCancel();
    } else if (state === 'idle') {
      onStartListening();
    }
    // transcribing / interrupted: button disabled, ignore clicks.
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      onSendTextMessage(textInput.trim());
      setTextInput('');
    }
  };

  const selectedVoice = AVAILABLE_VOICES.find((v) => v.id === selectedVoiceId) || AVAILABLE_VOICES[0];

  return (
    <div className="w-full max-w-2xl mx-auto px-4 mt-6 mb-8 flex flex-col items-center">
      {/* Microphone permission or error notification banner */}
      {permissionError && (
        <div className="w-full mb-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg flex items-start gap-2.5 text-xs text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
          <div className="flex-1">
            <span className="font-medium">Microphone Status:</span> {permissionError}
          </div>
        </div>
      )}

      {/* Main Microphone Button */}
      <div className="relative flex items-center justify-center">
        {/* Glowing ring while active */}
        {state === 'listening' && (
          <div className="absolute w-24 h-24 rounded-full bg-cyan-400/20 animate-ping pointer-events-none" />
        )}

        <button
          onClick={handleMicClick}
          disabled={state === 'transcribing' || state === 'interrupted'}
          className={`relative z-10 w-20 h-20 rounded-full flex flex-col items-center justify-center transition-all duration-200 shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080B14] disabled:opacity-50 disabled:cursor-wait ${
            state === 'listening'
              ? 'bg-cyan-500 text-[#080B14] hover:bg-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.5)] scale-105'
              : state === 'speaking' || state === 'thinking'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
              : 'bg-violet-600 hover:bg-violet-500 text-white shadow-[0_0_25px_rgba(139,92,246,0.35)] active:scale-95'
          }`}
          aria-label={
            state === 'listening'
              ? 'Stop listening and transcribe'
              : state === 'speaking' || state === 'thinking'
              ? 'Stop and cancel current response'
              : 'Start listening (Space or M)'
          }
        >
          {state === 'listening' ? (
            <>
              <Square className="w-7 h-7 fill-current" />
              <span className="text-[10px] font-bold tracking-wider mt-0.5 uppercase">Done</span>
            </>
          ) : state === 'speaking' || state === 'thinking' ? (
            <>
              <Square className="w-6 h-6 fill-current" />
              <span className="text-[10px] font-medium tracking-wider mt-0.5">Stop</span>
            </>
          ) : (
            <>
              <Mic className="w-8 h-8" />
              <span className="text-[10px] font-semibold tracking-wider mt-0.5 uppercase">Talk</span>
            </>
          )}
        </button>
      </div>

      {/* Keyboard hotkey hint */}
      <div className="mt-3 flex items-center gap-2 text-xs text-[#94A3B8]">
        <kbd className="px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 font-mono text-[10px] text-slate-300">
          Space
        </kbd>
        <span>or</span>
        <kbd className="px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 font-mono text-[10px] text-slate-300">
          M
        </kbd>
        <span>to speak</span>
        <span aria-hidden="true">·</span>
        <kbd className="px-1.5 py-0.5 rounded-sm bg-white/5 border border-white/10 font-mono text-[10px] text-slate-300">
          Esc
        </kbd>
        <span>to cancel</span>
      </div>

      {/* Bottom control panel: Language & Voice Selection */}
      <div className="w-full mt-6 pt-5 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Language selector */}
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-[#94A3B8]" />
          <span className="text-[#94A3B8]">Language:</span>
          <div className="flex items-center bg-[#111827] border border-white/10 rounded-lg p-0.5">
            <button
              onClick={() => onSelectLanguage('auto')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedLanguage === 'auto'
                  ? 'bg-violet-600 text-white'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              Auto-Detect
            </button>
            <button
              onClick={() => onSelectLanguage('en')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedLanguage === 'en'
                  ? 'bg-violet-600 text-white'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              English
            </button>
            <button
              onClick={() => onSelectLanguage('hi')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                selectedLanguage === 'hi'
                  ? 'bg-violet-600 text-white'
                  : 'text-[#94A3B8] hover:text-[#F8FAFC]'
              }`}
            >
              हिन्दी (Hindi)
            </button>
          </div>
        </div>

        {/* Voice selector dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-[#94A3B8]">Voice:</span>
          <div className="relative">
            <select
              value={selectedVoiceId}
              onChange={(e) => onSelectVoice(e.target.value)}
              className="appearance-none bg-[#111827] border border-white/10 text-[#F8FAFC] text-xs font-medium rounded-lg pl-3 pr-8 py-1.5 focus:outline-none focus:ring-1 focus:ring-violet-500 cursor-pointer"
            >
              {AVAILABLE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.accent})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowTextInput((p) => !p)}
            className="ml-2 text-xs text-[#94A3B8] hover:text-[#22D3EE] transition-colors underline underline-offset-2"
          >
            {showTextInput ? 'Hide Text' : 'Text Input'}
          </button>
        </div>
      </div>

      {/* Collapsible Text Fallback input (useful for silent environment testing) */}
      {showTextInput && (
        <form onSubmit={handleTextSubmit} className="w-full mt-4 flex items-center gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Type a message in English or हिन्दी (e.g. 'What open-weight models are loaded?')..."
            className="flex-1 bg-[#111827] border border-white/10 rounded-lg px-3.5 py-2 text-xs text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={!textInput.trim()}
            className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      )}
    </div>
  );
};
