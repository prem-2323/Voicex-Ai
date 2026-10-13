/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { VoiceState } from '../../types/voice';
import { audioManager } from '../../services/audioManager';

interface AudioVisualizerProps {
  state: VoiceState;
  height?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ state, height = 28 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);
  const phaseRef = useRef<number>(0);

  // Show waveform ONLY while recording (listening) or playing audio (speaking)
  const isAudioActive = state === 'listening' || state === 'speaking';

  useEffect(() => {
    if (!isAudioActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const h = canvas.height;
      const centerY = h / 2;

      ctx.clearRect(0, 0, width, h);

      phaseRef.current += 0.06;
      const phase = phaseRef.current;

      if (state === 'listening') {
        // Real microphone frequency data
        const freqData = audioManager.getFrequencyData();
        const barCount = 36;
        const barWidth = width / barCount - 2;

        for (let i = 0; i < barCount; i++) {
          const sampleIndex = Math.floor((i / barCount) * (freqData.length / 2));
          const val = freqData[sampleIndex] || 0;
          const normalized = val / 255;
          const barHeight = Math.max(3, normalized * (h * 0.9));

          const x = i * (barWidth + 2);
          const y = centerY - barHeight / 2;

          ctx.fillStyle = '#22D3EE';
          ctx.beginPath();
          ctx.roundRect(x, y, barWidth, barHeight, 1);
          ctx.fill();
        }
      } else if (state === 'speaking') {
        // Continuous harmonic speech wave
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#8B5CF6';
        ctx.beginPath();
        for (let x = 0; x < width; x++) {
          const amp = Math.sin(x * 0.03 + phase * 2) * (h * 0.32);
          const y = centerY + amp;
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
  }, [state, isAudioActive, height]);

  if (!isAudioActive) {
    return null;
  }

  return (
    <div className="w-full max-w-md mx-auto flex items-center justify-center my-1.5 animate-fadeIn">
      <canvas
        ref={canvasRef}
        width={360}
        height={height}
        className="w-full h-7 rounded bg-[#141C2B] border border-[#273247]"
        aria-hidden="true"
      />
    </div>
  );
};
