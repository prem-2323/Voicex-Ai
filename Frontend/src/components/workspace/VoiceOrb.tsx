/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { VoiceState } from '../../types/voice';

interface VoiceOrbProps {
  state: VoiceState;
  volume: number; // 0 to 1, strictly from real mic input
  onClick?: () => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, volume, onClick }) => {
  // Compute subtle, restrained scale strictly based on genuine state & volume
  const dynamicScale = useMemo(() => {
    if (state === 'listening' && volume > 0.02) {
      return Math.min(1.12, 1 + volume * 0.2);
    }
    if (state === 'speaking') {
      return 1.03;
    }
    return 1.0;
  }, [state, volume]);

  const statusText = useMemo(() => {
    switch (state) {
      case 'listening':
        return 'Listening...';
      case 'transcribing':
        return 'Transcribing...';
      case 'thinking':
        return 'Thinking...';
      case 'speaking':
        return 'Speaking...';
      case 'interrupted':
        return 'Interrupted';
      case 'idle':
      default:
        return 'Ready';
    }
  }, [state]);

  return (
    <div className="flex flex-col items-center justify-center select-none">
      {/* Voice Orb Container - Exactly ~196px diameter */}
      <div
        className="relative flex items-center justify-center cursor-pointer transition-transform duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F17] rounded-full"
        onClick={onClick}
        role="button"
        tabIndex={0}
        aria-label={`Voice Orb - Status: ${statusText}. Click to interact.`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        }}
        style={{
          transform: `scale(${dynamicScale})`,
        }}
      >
        {/* State-driven background & border */}
        <div
          className={`w-[196px] h-[196px] rounded-full flex items-center justify-center border transition-all duration-300 relative overflow-hidden ${
            state === 'listening'
              ? 'bg-[#141C2B] border-[#22D3EE] shadow-[0_0_24px_rgba(34,211,238,0.2)]'
              : state === 'speaking'
              ? 'bg-[#141C2B] border-[#8B5CF6] shadow-[0_0_24px_rgba(139,92,246,0.2)]'
              : state === 'thinking' || state === 'transcribing'
              ? 'bg-[#141C2B] border-[#8B5CF6]/80'
              : state === 'interrupted'
              ? 'bg-[#141C2B] border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.2)]'
              : 'bg-[#141C2B] border-[#273247] hover:border-[#8B5CF6]/50'
          }`}
          style={{
            background:
              state === 'listening'
                ? 'radial-gradient(circle at 50% 50%, #192335 0%, #141C2B 65%, #0E1420 100%)'
                : state === 'speaking'
                ? 'radial-gradient(circle at 50% 50%, #201b3b 0%, #141C2B 65%, #0E1420 100%)'
                : state === 'thinking' || state === 'transcribing'
                ? 'radial-gradient(circle at 50% 50%, #1c1833 0%, #141C2B 70%, #0E1420 100%)'
                : 'radial-gradient(circle at 50% 50%, #192335 0%, #141C2B 80%, #0E1420 100%)',
          }}
        >
          {/* Subtle inner reflection */}
          <div className="absolute inset-x-8 top-3 h-8 rounded-full bg-white/[0.04] blur-xs pointer-events-none" />

          {/* Thinking / Transcribing subtle spinner ring */}
          {(state === 'thinking' || state === 'transcribing') && (
            <div className="absolute inset-2 rounded-full border border-transparent border-t-[#8B5CF6] border-r-[#22D3EE]/60 animate-spin pointer-events-none" style={{ animationDuration: '2s' }} />
          )}

          {/* Core Graphic */}
          <div className="relative z-10 flex items-center justify-center">
            {state === 'idle' && (
              <div className="flex flex-col items-center">
                <div className="w-10 h-10 rounded-full border border-[#273247] flex items-center justify-center bg-[#0E1420]/80">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6]" />
                </div>
              </div>
            )}

            {state === 'listening' && (
              <div className="flex items-center gap-1.5 h-12">
                {[0.4, 0.8, 1.0, 0.7, 0.9, 0.5, 0.3].map((bar, i) => {
                  const barH = Math.max(8, (bar + volume * 1.6) * 36);
                  return (
                    <div
                      key={i}
                      className="w-1 bg-[#22D3EE] rounded-full transition-all duration-75"
                      style={{ height: `${barH}px` }}
                    />
                  );
                })}
              </div>
            )}

            {(state === 'thinking' || state === 'transcribing') && (
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-[#22D3EE] animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}

            {state === 'speaking' && (
              <div className="flex items-center gap-1.5 h-12">
                {[0.5, 0.9, 1.2, 0.8, 1.1, 0.7, 0.4].map((bar, i) => (
                  <div
                    key={i}
                    className="w-1 bg-[#8B5CF6] rounded-full animate-pulse transition-all duration-150"
                    style={{
                      height: `${Math.max(10, bar * 28)}px`,
                      animationDelay: `${i * 100}ms`,
                    }}
                  />
                ))}
              </div>
            )}

            {state === 'interrupted' && (
              <div className="w-8 h-8 rounded-full border border-amber-500/50 bg-amber-500/10 flex items-center justify-center">
                <div className="w-2.5 h-2.5 bg-amber-400 rounded-xs" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clear Status Label: Ready, Listening, Transcribing, Thinking, Speaking, Interrupted */}
      <div className="mt-3 text-center">
        <p className="text-xs font-semibold tracking-wide uppercase text-[#F1F5F9]">
          {statusText}
        </p>
      </div>
    </div>
  );
};
