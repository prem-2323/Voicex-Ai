/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Mic, Square, AlertCircle, Globe, ChevronDown, Upload } from 'lucide-react';
import { VoiceOrb } from './VoiceOrb';
import { AudioVisualizer } from './AudioVisualizer';
import { ConversationTurnPanel } from './ConversationTurnPanel';
import { useVoice } from '../../context/VoiceContext';
import { AVAILABLE_VOICES } from '../../config/apiConfig';

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
    interruptTurn,
    replayAssistantMessage,
    toggleMute,
    updateSettings,
    sendTextMessage,
    uploadAndProcessAudio,
  } = useVoice();

  const [textInputValue, setTextInputValue] = useState('');

  // Global keyboard shortcuts (Space or M to talk/interrupt, Esc to cancel)
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
        } else if (voiceState === 'speaking' || voiceState === 'thinking') {
          interruptTurn();
        } else if (voiceState === 'idle' || voiceState === 'interrupted' || voiceState === 'error') {
          startListening();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancelTurn();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [voiceState, startListening, stopListeningAndProcess, cancelTurn, interruptTurn]);

  const [isClickDebounced, setIsClickDebounced] = useState(false);

  const handleMicClick = () => {
    if (isClickDebounced) return;

    if (voiceState === 'transcribing') {
      return; // Prevent duplicate requests while transcribing
    }

    if (voiceState === 'listening') {
      setIsClickDebounced(true);
      setTimeout(() => setIsClickDebounced(false), 600);
      stopListeningAndProcess();
    } else if (voiceState === 'speaking' || voiceState === 'thinking') {
      interruptTurn();
    } else if (voiceState === 'idle' || voiceState === 'error' || voiceState === 'interrupted') {
      setIsClickDebounced(true);
      setTimeout(() => setIsClickDebounced(false), 400);
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

  // Circular audio meter calculation for microphone perimeter
  // Radius = 37px, Perimeter = 2 * PI * 37 ≈ 232.48
  const meterRadius = 37;
  const meterCircumference = 2 * Math.PI * meterRadius;
  const clampedVolume = Math.min(1, Math.max(0, micVolume * 1.5));
  const strokeDashoffset = meterCircumference * (1 - clampedVolume);

  return (
    <div className="flex-1 h-full w-full flex flex-col justify-between overflow-hidden bg-[#0B0F17] relative select-none">
      {/* Dynamic Ambient Glow Mesh Blobs (creates true optical refraction for glass) */}
      <div className="ambient-blob-1 -top-24 -left-24" />
      <div className="ambient-blob-2 top-1/3 -right-28" />
      <div className="ambient-blob-3 -bottom-20 left-1/4" />

      {/* Floating Toast Notification for Permissions / Errors (Zero Layout Shift) */}
      {permissionError && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 max-w-md w-auto px-4 py-2 glass-panel border border-rose-500/40 bg-rose-500/20 backdrop-blur-xl rounded-full flex items-center gap-2.5 text-xs text-rose-200 shadow-[0_8px_32px_rgba(244,63,94,0.3)] pointer-events-auto">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="truncate">{permissionError}</span>
        </div>
      )}

      {/* Main Dual-Column Stage (Left: Orb & Mic, Right: Suggestions, Human Transcript & AI Reply) */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col md:flex-row items-center md:items-stretch justify-between p-3 md:p-5 gap-4 md:gap-6 relative z-10 max-w-7xl mx-auto w-full">
        {/* Left Side: Voice Orb, Waveform Visualizer, Mic Button & State Indicators */}
        <div className="w-full md:w-[46%] lg:w-[44%] flex flex-col items-center justify-center min-h-0 overflow-hidden relative py-1">
          {/* 1. Voice Orb (Ultra-smooth organic fluid Canvas) */}
          <VoiceOrb
            state={voiceState}
            volume={micVolume}
            size={220}
            onClick={handleMicClick}
          />

          {/* 2. Waveform Visualizer (Frosted Glass Capsule with Dual Modes) */}
          <AudioVisualizer state={voiceState} height={34} />

          {/* 3. Hero Microphone Button & Sonic Ripples */}
          <div className="flex flex-col items-center mt-2 mb-1 select-none">
            <div className="relative flex items-center justify-center">
              {/* Audio-Reactive Sonic Ripple Rings (visible while listening) */}
              {voiceState === 'listening' && (
                <>
                  <div
                    className="absolute w-20 h-20 rounded-full border border-cyan-400/60 animate-sonic-ripple-1 pointer-events-none"
                    style={{
                      transform: `scale(${1 + clampedVolume * 0.4})`,
                    }}
                  />
                  <div
                    className="absolute w-24 h-24 rounded-full border border-cyan-400/40 animate-sonic-ripple-2 pointer-events-none"
                    style={{
                      transform: `scale(${1 + clampedVolume * 0.6})`,
                    }}
                  />
                  <div
                    className="absolute w-28 h-28 rounded-full border border-cyan-400/20 animate-sonic-ripple-3 pointer-events-none"
                    style={{
                      transform: `scale(${1 + clampedVolume * 0.8})`,
                    }}
                  />
                </>
              )}

              {/* High-speed Quantum Processing Ring (Thinking / Transcribing) */}
              {(voiceState === 'thinking' || voiceState === 'transcribing') && (
                <div className="absolute w-[86px] h-[86px] rounded-full p-[2px] animate-mic-spin-ring pointer-events-none">
                  <div className="w-full h-full rounded-full bg-gradient-to-tr from-cyan-400 via-violet-500 to-fuchsia-500 blur-[2px] opacity-80" />
                </div>
              )}

              {/* Assistant Speaking Ambient Aura */}
              {voiceState === 'speaking' && (
                <div className="absolute w-24 h-24 rounded-full bg-violet-500/25 blur-xl animate-pulse pointer-events-none" />
              )}

              {/* Audio Upload button (floats to the left of the mic) */}
              <div className="absolute -left-16 flex items-center">
                <label
                  className="w-10 h-10 rounded-full flex items-center justify-center glass-button text-[#94A3B8] hover:text-[#22D3EE] cursor-pointer transition-all shadow-md group"
                  title="Upload audio file (.wav, .mp3, .m4a, .webm, .flac)"
                >
                  <input
                    type="file"
                    accept=".wav,.mp3,.m4a,.webm,.ogg,.flac"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        uploadAndProcessAudio(file);
                        e.target.value = '';
                      }
                    }}
                  />
                  <Upload className="w-4 h-4 group-hover:scale-110 transition-transform" />
                </label>
              </div>

              {/* Circular Volume Meter SVG Ring (traces circumference of microphone) */}
              <svg
                className="absolute w-[86px] h-[86px] -rotate-90 pointer-events-none"
                viewBox="0 0 86 86"
              >
                {/* Background track */}
                <circle
                  cx="43"
                  cy="43"
                  r={meterRadius}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.08)"
                  strokeWidth="2.5"
                />
                {/* Active audio energy fill */}
                {voiceState === 'listening' && (
                  <circle
                    cx="43"
                    cy="43"
                    r={meterRadius}
                    fill="none"
                    stroke="#22D3EE"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeDasharray={meterCircumference}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-75"
                    style={{
                      filter: 'drop-shadow(0 0 4px #22D3EE)',
                    }}
                  />
                )}
              </svg>

              {/* Main Microphone Button */}
              <button
                onClick={handleMicClick}
                disabled={isClickDebounced || voiceState === 'transcribing'}
                className={`relative z-10 w-[68px] h-[68px] rounded-full flex flex-col items-center justify-center transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F17] disabled:opacity-50 disabled:cursor-not-allowed group ${
                  voiceState === 'listening'
                    ? 'bg-gradient-to-b from-cyan-400 to-cyan-500 text-[#080B14] shadow-[0_0_35px_rgba(34,211,238,0.7)] scale-105 active:scale-95'
                    : voiceState === 'transcribing'
                    ? 'bg-slate-900/90 text-cyan-300 border border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.3)]'
                    : voiceState === 'speaking' || voiceState === 'thinking'
                    ? 'bg-gradient-to-b from-amber-500/30 to-amber-600/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/40 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
                    : 'bg-gradient-to-b from-violet-600/90 to-violet-800/90 hover:from-violet-500 hover:to-violet-700 text-white shadow-[0_0_30px_rgba(139,92,246,0.4)] hover:shadow-[0_0_40px_rgba(139,92,246,0.6)] hover:scale-105 active:scale-95 border border-white/20'
                }`}
                aria-label={
                  voiceState === 'listening'
                    ? 'Stop listening'
                    : voiceState === 'transcribing'
                    ? 'Transcribing audio...'
                    : voiceState === 'speaking' || voiceState === 'thinking'
                    ? 'Cancel response'
                    : 'Start talking (Space or M)'
                }
              >
                {/* Specular curved top gloss highlight */}
                <div className="absolute inset-x-3 top-1.5 h-3.5 rounded-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

                {voiceState === 'listening' ? (
                  <>
                    <Square className="w-5 h-5 fill-current transition-transform group-hover:scale-110" />
                    <span className="text-[9px] font-bold tracking-wider mt-0.5 uppercase">
                      Stop
                    </span>
                  </>
                ) : voiceState === 'transcribing' ? (
                  <div className="w-5 h-5 border-2 border-transparent border-t-cyan-400 border-r-cyan-400 rounded-full animate-spin" />
                ) : voiceState === 'speaking' || voiceState === 'thinking' ? (
                  <>
                    <Square className="w-5 h-5 fill-current transition-transform group-hover:scale-110" />
                    <span className="text-[9px] font-medium tracking-wider mt-0.5">Cancel</span>
                  </>
                ) : (
                  <>
                    <Mic className="w-6 h-6 transition-transform group-hover:scale-110" />
                    <span className="text-[9px] font-semibold tracking-wider mt-0.5 uppercase">
                      Talk
                    </span>
                  </>
                )}
              </button>
            </div>

            {/* Dynamic State Hint */}
            <div className="mt-2.5 flex items-center justify-center h-7 shrink-0">
              {voiceState === 'listening' ? (
                <div className="flex items-center gap-1.5 text-xs text-cyan-300 font-medium glass-pill px-3 py-0.5 rounded-full border border-cyan-400/30">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                  </span>
                  <span>Listening... speak freely (auto-replies on silence)</span>
                </div>
              ) : voiceState === 'speaking' ? (
                <div className="flex items-center gap-1.5 text-xs text-fuchsia-300 font-medium glass-pill px-3 py-0.5 rounded-full border border-fuchsia-400/30">
                  <span className="w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
                  <span>Assistant speaking · Speak anytime to interrupt (Barge-in active)</span>
                </div>
              ) : voiceState === 'interrupted' ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium glass-pill px-3 py-0.5 rounded-full border border-amber-400/30 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                  <span>Interrupted! Listening to your voice now...</span>
                </div>
              ) : voiceState === 'thinking' || voiceState === 'transcribing' ? (
                <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium glass-pill px-3 py-0.5 rounded-full border border-amber-400/30 animate-pulse">
                  <span>
                    {voiceState === 'transcribing'
                      ? 'Transcribing your audio...'
                      : 'Generating AI response · Speak to interrupt...'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-[11px] text-[#94A3B8] glass-pill px-3 py-0.5 rounded-full border border-white/10">
                  <kbd className="px-1.5 py-0.2 rounded bg-white/10 border border-white/10 font-mono text-[9px] text-slate-200">
                    Space
                  </kbd>
                  <span>or</span>
                  <kbd className="px-1.5 py-0.2 rounded bg-white/10 border border-white/10 font-mono text-[9px] text-slate-200">
                    M
                  </kbd>
                  <span>to speak</span>
                  <span aria-hidden="true" className="opacity-40">·</span>
                  <kbd className="px-1.5 py-0.2 rounded bg-white/10 border border-white/10 font-mono text-[9px] text-slate-200">
                    Esc
                  </kbd>
                  <span>to cancel</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Suggested Prompts, Human Say, AI Reply, & Integrated Text Input */}
        <div className="w-full md:w-[54%] lg:w-[56%] flex flex-col min-h-0 overflow-hidden h-full">
          <ConversationTurnPanel
            transcript={liveTranscript.text}
            isFinalTranscript={liveTranscript.isFinal}
            detectedLang={liveTranscript.language}
            streamingText={liveStreamingText}
            voiceState={voiceState}
            lastUserMessage={lastUserMessage}
            lastAssistantMessage={lastAssistantMessage}
            messages={messages}
            isMuted={isMuted}
            onReplay={replayAssistantMessage}
            onStopSpeaking={interruptTurn}
            onToggleMute={toggleMute}
            onSelectPrompt={(text) => sendTextMessage(text)}
            textInputValue={textInputValue}
            onTextInputChange={setTextInputValue}
            onTextSubmit={handleTextSubmit}
          />
        </div>
      </div>

      {/* Bottom Frosted Glass Toolbar */}
      <footer className="h-11 border-t border-white/10 glass-panel bg-slate-950/80 px-4 md:px-6 flex items-center justify-between gap-3 text-xs shrink-0 select-none relative z-20">
        {/* Language selector segmented control */}
        <div className="flex items-center gap-2">
          <Globe className="w-3.5 h-3.5 text-[#94A3B8]" />
          <span className="text-[#94A3B8] hidden sm:inline font-medium">Language:</span>
          <div className="flex items-center glass-pill rounded-lg p-0.5 border border-white/10">
            <button
              onClick={() => updateSettings({ language: 'auto' })}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                settings.language === 'auto'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              Auto
            </button>
            <button
              onClick={() => updateSettings({ language: 'en' })}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                settings.language === 'en'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              English
            </button>
            <button
              onClick={() => updateSettings({ language: 'hi' })}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                settings.language === 'hi'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9]'
              }`}
            >
              हिन्दी
            </button>
          </div>
        </div>

        {/* Voice selector dropdown */}
        <div className="flex items-center gap-2.5">
          <span className="text-[#94A3B8] hidden sm:inline font-medium">Voice:</span>
          <div className="relative">
            <select
              value={settings.selectedVoiceId}
              onChange={(e) => updateSettings({ selectedVoiceId: e.target.value })}
              className="appearance-none glass-pill border border-white/10 text-[#F1F5F9] text-[11px] font-medium rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:border-violet-500 cursor-pointer shadow-sm hover:border-white/20 transition-all"
            >
              {AVAILABLE_VOICES.map((v) => (
                <option key={v.id} value={v.id} className="bg-[#141C2B] text-white">
                  {v.name}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-[#94A3B8] absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </footer>
    </div>
  );
};
