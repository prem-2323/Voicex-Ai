/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Mic, Square, AlertCircle, Globe, ChevronDown, Send } from 'lucide-react';
import { VoiceOrb } from './VoiceOrb';
import { AudioVisualizer } from './AudioVisualizer';
import { ConversationTurnPanel } from './ConversationTurnPanel';
import { useVoice } from '../../context/VoiceContext';
import { AVAILABLE_VOICES } from '../../config/apiConfig';
import { LanguageCode } from '../../types/voice';

export const WorkspaceView: React.FC = () => {
  const {
    voiceState,
    micVolume,
    liveTranscript,
    liveStreamingText,
    activeConversation,
    settings,
    isMuted,
    permissionError,
    startListening,
    stopListeningAndProcess,
    cancelTurn,
    replayAssistantMessage,
    toggleMute,
    updateSettings,
    sendTextMessage,
    activeScenario,
    setScenario,
  } = useVoice();

  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputValue, setTextInputValue] = useState('');

  // Global keyboard shortcuts (Space or M to talk, Esc to cancel)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        if (e.key === 'Escape') {
          cancelTurn();
        }
        return;
      }

      if (e.code === 'Space' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        if (voiceState === 'listening') {
          stopListeningAndProcess();
        } else if (voiceState === 'idle') {
          startListening();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelTurn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voiceState, startListening, stopListeningAndProcess, cancelTurn]);

  const handleMicClick = () => {
    if (voiceState === 'listening') {
      stopListeningAndProcess();
    } else if (voiceState === 'speaking' || voiceState === 'thinking') {
      cancelTurn();
    } else {
      startListening();
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInputValue.trim()) {
      sendTextMessage(textInputValue.trim());
      setTextInputValue('');
    }
  };

  const messages = activeConversation?.messages || [];
  const lastUserMessage = messages.slice().reverse().find((m) => m.role === 'user') || null;
  const lastAssistantMessage = messages.slice().reverse().find((m) => m.role === 'assistant') || null;

  const SCENARIOS = {
    general: 'General Assistant',
    support: 'Customer Support',
    lead: 'Lead Qualification',
    appointment: 'Appointment Enquiry',
  };

  return (
    <div className="flex-1 flex flex-col justify-between h-[calc(100vh-56px)] overflow-hidden bg-[#0B0F17]">
      {/* Scrollable core container */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center p-3 md:p-4 min-h-0">
        
        {/* Scenario Selector & Header */}
        <div className="w-full max-w-xl flex items-center justify-between mb-4">
          <div className="relative">
            <select
              value={activeScenario}
              onChange={(e) => setScenario(e.target.value as any)}
              className="appearance-none bg-[#141C2B] border border-[#273247] text-[#F1F5F9] text-[11px] font-medium rounded-md pl-2.5 pr-7 py-1.5 focus:outline-none focus:border-[#8B5CF6] cursor-pointer"
            >
              {Object.entries(SCENARIOS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#94A3B8] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <span className="text-[11px] text-[#94A3B8] font-mono tabular-nums bg-[#141C2B] px-2 py-1 rounded">
            {activeConversation?.id.slice(-6).toUpperCase()}
          </span>
        </div>

        <div className="w-full max-w-xl flex flex-col items-center">
          {/* Microphone Permission / Error notification banner */}
          {permissionError && (
            <div className="w-full mb-2 p-2 bg-rose-500/10 border border-rose-500/20 rounded-md flex items-center gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="truncate">{permissionError}</span>
            </div>
          )}

          {/* 1. Voice Orb (196px diameter) */}
          <VoiceOrb
            state={voiceState}
            volume={micVolume}
            onClick={handleMicClick}
          />

          {/* 2. Compact Live Audio Waveform (Visible ONLY while recording/speaking) */}
          <AudioVisualizer state={voiceState} height={28} />

          {/* 3. Single Prominent Microphone Button */}
          <div className="flex flex-col items-center mt-2 mb-2">
            <button
              onClick={handleMicClick}
              className={`w-13 h-13 rounded-full flex items-center justify-center transition-all duration-150 shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] ${
                voiceState === 'listening'
                  ? 'bg-[#22D3EE] text-[#0B0F17] hover:bg-[#06B6D4] shadow-[0_0_16px_rgba(34,211,238,0.4)]'
                  : voiceState === 'speaking' || voiceState === 'thinking'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                  : 'bg-[#8B5CF6] hover:bg-[#7C3AED] text-white active:scale-95'
              }`}
              aria-label={
                voiceState === 'listening'
                  ? 'Stop listening'
                  : voiceState === 'speaking' || voiceState === 'thinking'
                  ? 'Cancel response'
                  : 'Start talking'
              }
            >
              {voiceState === 'listening' ? (
                <Square className="w-5 h-5 fill-current" />
              ) : voiceState === 'speaking' || voiceState === 'thinking' ? (
                <Square className="w-5 h-5 fill-current" />
              ) : (
                <Mic className="w-6 h-6" />
              )}
            </button>

            {/* Keyboard shortcut hint */}
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#94A3B8]">
              <kbd className="px-1 py-0.2 rounded bg-[#141C2B] border border-[#273247] font-mono text-[10px] text-[#F1F5F9]">
                Space
              </kbd>
              <span>or</span>
              <kbd className="px-1 py-0.2 rounded bg-[#141C2B] border border-[#273247] font-mono text-[10px] text-[#F1F5F9]">
                M
              </kbd>
              <span>to speak</span>
            </div>
          </div>

          {/* 4. Compact Conversation Turn Panel */}
          <ConversationTurnPanel
            transcript={liveTranscript.text}
            isFinalTranscript={liveTranscript.isFinal}
            detectedLang={liveTranscript.language}
            streamingText={liveStreamingText}
            voiceState={voiceState}
            lastUserMessage={lastUserMessage}
            lastAssistantMessage={lastAssistantMessage}
            isMuted={isMuted}
            onReplay={replayAssistantMessage}
            onStopSpeaking={cancelTurn}
            onToggleMute={toggleMute}
            onSelectPrompt={(text) => sendTextMessage(text)}
          />

          {/* Optional inline text input when toggled */}
          {showTextInput && (
            <form onSubmit={handleTextSubmit} className="w-full mt-2 flex items-center gap-2">
              <input
                type="text"
                value={textInputValue}
                onChange={(e) => setTextInputValue(e.target.value)}
                placeholder="Type message in English or हिन्दी..."
                className="flex-1 bg-[#141C2B] border border-[#273247] rounded-lg px-3 py-1.5 text-xs text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#8B5CF6]"
              />
              <button
                type="submit"
                disabled={!textInputValue.trim()}
                className="px-3 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] disabled:opacity-40 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <Send className="w-3 h-3" />
                <span>Send</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 5. Compact Bottom Toolbar (Pinned, approximately 44px) */}
      <footer className="h-11 border-t border-[#273247] bg-[#0E1420] px-4 md:px-6 flex items-center justify-between gap-3 text-xs shrink-0 select-none">
        {/* Language selector segmented control */}
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span className="text-[#94A3B8] hidden sm:inline">Language:</span>
          <div className="flex items-center bg-[#141C2B] border border-[#273247] rounded-md p-0.5">
            <button
              onClick={() => updateSettings({ language: 'auto' })}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                settings.language === 'auto'
                  ? 'bg-[#8B5CF6] text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              Auto
            </button>
            <button
              onClick={() => updateSettings({ language: 'en' })}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                settings.language === 'en'
                  ? 'bg-[#8B5CF6] text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              English
            </button>
            <button
              onClick={() => updateSettings({ language: 'hi' })}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                settings.language === 'hi'
                  ? 'bg-[#8B5CF6] text-white'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              हिन्दी
            </button>
          </div>
        </div>

        {/* Voice selector & text toggle */}
        <div className="flex items-center gap-2.5">
          <span className="text-[#94A3B8] hidden sm:inline">Voice:</span>
          <div className="relative">
            <select
              value={settings.selectedVoiceId}
              onChange={(e) => updateSettings({ selectedVoiceId: e.target.value })}
              className="appearance-none bg-[#141C2B] border border-[#273247] text-[#F1F5F9] text-[11px] font-medium rounded-md pl-2.5 pr-6 py-1 focus:outline-none focus:border-[#8B5CF6] cursor-pointer"
            >
              {AVAILABLE_VOICES.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 text-[#94A3B8] absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={() => setShowTextInput((p) => !p)}
            className="text-[11px] text-[#94A3B8] hover:text-[#22D3EE] transition-colors"
          >
            {showTextInput ? 'Hide Input' : 'Text Input'}
          </button>
        </div>
      </footer>
    </div>
  );
};
