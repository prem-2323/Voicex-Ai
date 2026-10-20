/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { VoiceState } from '../../types/voice';
import { audioManager } from '../../services/audioManager';
import { Activity, Mic, Volume2 } from 'lucide-react';

interface AudioVisualizerProps {
  state: VoiceState;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ state, height = 34 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  // Persistent smoothed bars state for peak smoothing
  const smoothedBarsRef = useRef<number[]>(new Array(44).fill(2));
  const phaseRef = useRef<number>(0);
  const [liveDb, setLiveDb] = useState<number>(-45);

  const isListening = state === 'listening';
  const isSpeaking = state === 'speaking';
  const isThinking = state === 'thinking' || state === 'transcribing';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalWidth = 460;
    const logicalHeight = height;

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;
    ctx.scale(dpr, dpr);

    const barCount = 44;
    if (smoothedBarsRef.current.length !== barCount) {
      smoothedBarsRef.current = new Array(barCount).fill(2);
    }

    let lastDbUpdate = 0;

    const render = (timestamp: number) => {
      const centerY = logicalHeight / 2;
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      phaseRef.current += 0.045;
      const phase = phaseRef.current;

      if (isListening) {
        // Mode 1: Real Microphone Frequency Bars with Smooth Spring Smoothing
        const freqData = audioManager.getFrequencyData();
        const barSpacing = logicalWidth / barCount;
        const barWidth = Math.max(3, barSpacing - 3);

        let sumEnergy = 0;

        for (let i = 0; i < barCount; i++) {
          // Sample lower and mid speech frequencies preferentially
          const freqIndex = Math.floor(Math.pow(i / barCount, 1.2) * (freqData.length * 0.65));
          const rawVal = freqData[freqIndex] || 0;
          const targetHeight = Math.max(3, (rawVal / 255) * (logicalHeight * 0.92));

          sumEnergy += rawVal;

          // Smooth lerping with fast rise and gentle decay
          const current = smoothedBarsRef.current[i];
          if (targetHeight > current) {
            smoothedBarsRef.current[i] += (targetHeight - current) * 0.45; // Fast attack
          } else {
            smoothedBarsRef.current[i] += (targetHeight - current) * 0.12; // Smooth decay
          }

          const h = smoothedBarsRef.current[i];
          const x = i * barSpacing + 2;
          const y = centerY - h / 2;

          // Vertical color gradient
          const grad = ctx.createLinearGradient(x, centerY - h / 2, x, centerY + h / 2);
          grad.addColorStop(0, '#22D3EE'); // Cyan top
          grad.addColorStop(0.5, '#38BDF8'); // Sky center
          grad.addColorStop(1, '#8B5CF6'); // Violet bottom

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, h, 2);
          ctx.fill();

          // Luminous tip dot
          if (h > 12) {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.arc(x + barWidth / 2, y + 1.5, 1.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        // Live dB estimation
        if (timestamp - lastDbUpdate > 120) {
          const avg = sumEnergy / barCount;
          const dbVal = avg > 5 ? Math.round(-40 + (avg / 255) * 40) : -48;
          setLiveDb(dbVal);
          lastDbUpdate = timestamp;
        }
      } else if (isSpeaking) {
        // Mode 2: Multi-harmonic Flowing Wave Ribbon (Voice Output)
        const ribbonWidth = logicalWidth;

        // Draw translucent background wave fill
        const fillGrad = ctx.createLinearGradient(0, 0, 0, logicalHeight);
        fillGrad.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
        fillGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.15)');
        fillGrad.addColorStop(1, 'transparent');

        ctx.beginPath();
        ctx.moveTo(0, centerY);

        for (let x = 0; x <= ribbonWidth; x += 4) {
          const progress = x / ribbonWidth;
          // Gaussian envelope (tapers smoothly at edges)
          const envelope = Math.sin(progress * Math.PI);
          const wave1 = Math.sin(x * 0.04 + phase * 2.5) * 14;
          const wave2 = Math.sin(x * 0.08 - phase * 1.8) * 8;
          const y = centerY + (wave1 + wave2) * envelope;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(ribbonWidth, centerY);
        ctx.fillStyle = fillGrad;
        ctx.fill();

        // Layer 1: Glow stroke
        ctx.lineWidth = 2.5;
        const strokeGrad = ctx.createLinearGradient(0, 0, ribbonWidth, 0);
        strokeGrad.addColorStop(0, '#8B5CF6');
        strokeGrad.addColorStop(0.5, '#EC4899');
        strokeGrad.addColorStop(1, '#38BDF8');

        ctx.strokeStyle = strokeGrad;
        ctx.beginPath();
        for (let x = 0; x <= ribbonWidth; x += 3) {
          const progress = x / ribbonWidth;
          const envelope = Math.sin(progress * Math.PI);
          const wave1 = Math.sin(x * 0.04 + phase * 2.5) * 14;
          const wave2 = Math.sin(x * 0.08 - phase * 1.8) * 8;
          const y = centerY + (wave1 + wave2) * envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Layer 2: Harmonic secondary ghost wave
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        for (let x = 0; x <= ribbonWidth; x += 4) {
          const progress = x / ribbonWidth;
          const envelope = Math.sin(progress * Math.PI);
          const y = centerY + Math.cos(x * 0.06 - phase * 3) * 10 * envelope;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else if (isThinking) {
        // Mode 3: Concentric Quantum Shimmer Wave (Processing)
        const ribbonWidth = logicalWidth;
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.5)';
        ctx.beginPath();
        for (let x = 0; x <= ribbonWidth; x += 4) {
          const y = centerY + Math.sin(x * 0.05 + phase * 3.5) * 4;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      } else {
        // Mode 4: Idle Calm Micro-Waveform
        const ribbonWidth = logicalWidth;
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
        ctx.beginPath();
        for (let x = 0; x <= ribbonWidth; x += 4) {
          const y = centerY + Math.sin(x * 0.02 + phase * 0.8) * 2;
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [state, isListening, isSpeaking, isThinking, height]);

  return (
    <div className="w-full max-w-md mx-auto my-1 px-1">
      {/* Frosted Glass Waveform Container */}
      <div className="glass-panel rounded-2xl p-2.5 border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.35)] relative overflow-hidden">
        {/* Subtle top glare highlight */}
        <div className="absolute inset-x-4 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent pointer-events-none" />

        {/* Top telemetry bar inside the glass pill */}
        <div className="flex items-center justify-between px-1 mb-1.5 text-[10px] font-mono tracking-wider select-none">
          <div className="flex items-center gap-1.5">
            {isListening ? (
              <>
                <Mic className="w-3 h-3 text-cyan-400 animate-pulse" />
                <span className="text-cyan-300 font-semibold">LIVE AUDIO INPUT</span>
              </>
            ) : isSpeaking ? (
              <>
                <Volume2 className="w-3 h-3 text-fuchsia-400 animate-pulse" />
                <span className="text-fuchsia-300 font-semibold">NEURAL VOICE SYNTHESIS</span>
              </>
            ) : isThinking ? (
              <>
                <Activity className="w-3 h-3 text-violet-400 animate-pulse" />
                <span className="text-violet-300 font-semibold">TOKEN PROCESSING</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-slate-400">AUDIO ENGINE READY</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isListening && (
              <span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 tabular-nums">
                {liveDb > -45 ? `${liveDb} dB` : 'SILENCE'}
              </span>
            )}
            <span className="text-[#94A3B8]/60 text-[9px]">48kHz PCM</span>
          </div>
        </div>

        {/* Dynamic Waveform Canvas */}
        <div className="w-full flex items-center justify-center">
          <canvas
            ref={canvasRef}
            style={{ height }}
            className="w-full rounded-lg"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
};
