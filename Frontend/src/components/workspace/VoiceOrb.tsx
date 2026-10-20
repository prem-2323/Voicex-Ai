/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useMemo } from 'react';
import { VoiceState } from '../../types/voice';
import { Radio, Loader2 } from 'lucide-react';

interface VoiceOrbProps {
  state: VoiceState;
  volume: number; // 0 to 1, live from audio input
  size?: number;
  onClick?: () => void;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({ state, volume, size = 220, onClick }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  // Smooth interpolated physics variables (persisted across render frames)
  const physicsRef = useRef({
    smoothedVolume: 0,
    smoothedScale: 1,
    time: 0,
    shockwaveRadius: 0,
    shockwaveAlpha: 0,
    particlePhase: 0,
    targetStateHue: 250, // HSL hue tracker for smooth color morphing
    currentHue: 250,
  });

  // State text and semantic details
  const statusMeta = useMemo(() => {
    switch (state) {
      case 'listening':
        return {
          text: 'Listening...',
          badgeBg: 'bg-cyan-500/10 border-cyan-400/30 text-cyan-300',
          dotColor: 'bg-cyan-400',
          hint: 'Speak now — auto-transcribes on silence',
        };
      case 'transcribing':
        return {
          text: 'Transcribing...',
          badgeBg: 'bg-teal-500/10 border-teal-400/30 text-teal-300',
          dotColor: 'bg-teal-400',
          hint: 'Converting speech into text tokens',
        };
      case 'thinking':
        return {
          text: 'Thinking...',
          badgeBg: 'bg-violet-500/10 border-violet-400/30 text-violet-300',
          dotColor: 'bg-violet-400',
          hint: 'AI synthesizing response...',
        };
      case 'speaking':
        return {
          text: 'Speaking...',
          badgeBg: 'bg-fuchsia-500/10 border-fuchsia-400/30 text-fuchsia-300',
          dotColor: 'bg-fuchsia-400',
          hint: 'Streaming real-time voice response',
        };
      case 'interrupted':
        return {
          text: 'Interrupted',
          badgeBg: 'bg-amber-500/10 border-amber-400/30 text-amber-300',
          dotColor: 'bg-amber-400',
          hint: 'Turn cancelled via user voice interruption',
        };
      case 'error':
        return {
          text: 'Error',
          badgeBg: 'bg-rose-500/10 border-rose-400/30 text-rose-300',
          dotColor: 'bg-rose-400',
          hint: 'Check microphone permission or connection',
        };
      case 'idle':
      default:
        return {
          text: 'Ready to Chat',
          badgeBg: 'bg-slate-500/10 border-white/10 text-slate-300',
          dotColor: 'bg-violet-400',
          hint: 'Click orb or tap Mic to speak',
        };
    }
  }, [state]);

  // Click trigger: spring shockwave
  const handleOrbClick = () => {
    physicsRef.current.shockwaveRadius = 20;
    physicsRef.current.shockwaveAlpha = 0.8;
    onClick?.();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI retina display rendering
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const logicalSize = size;
    canvas.width = logicalSize * dpr;
    canvas.height = logicalSize * dpr;
    ctx.scale(dpr, dpr);

    const centerX = logicalSize / 2;
    const centerY = logicalSize / 2;
    const baseRadius = Math.round(logicalSize * 0.283);

    const render = () => {
      const p = physicsRef.current;

      // 1. Smooth lerping of audio volume (exponential decay)
      p.smoothedVolume += (volume - p.smoothedVolume) * 0.12;

      // 2. Set target hue based on state
      let targetHue = 250; // Idle violet
      if (state === 'listening') targetHue = 188; // Cyan
      else if (state === 'transcribing') targetHue = 170; // Teal
      else if (state === 'thinking') targetHue = 270; // Purple
      else if (state === 'speaking') targetHue = 295; // Magenta / Fuchsia
      else if (state === 'interrupted') targetHue = 38; // Amber
      else if (state === 'error') targetHue = 350; // Rose

      p.targetStateHue = targetHue;
      p.currentHue += (p.targetStateHue - p.currentHue) * 0.08;

      // 3. Time advancement according to state velocity
      let timeStep = 0.025;
      if (state === 'thinking' || state === 'transcribing') timeStep = 0.055;
      else if (state === 'speaking') timeStep = 0.04;
      else if (state === 'listening') timeStep = 0.035 + p.smoothedVolume * 0.08;
      p.time += timeStep;

      p.particlePhase += (state === 'thinking' || state === 'transcribing' ? 0.05 : 0.02);

      // 4. Clear canvas
      ctx.clearRect(0, 0, logicalSize, logicalSize);

      // 5. Draw Ambient Backlight Halo (Subtle diffused glow behind orb)
      const glowIntensity = state === 'listening' ? 0.45 + p.smoothedVolume * 0.4 : 0.35;
      const glowRadius = baseRadius * (1.2 + (state === 'listening' ? p.smoothedVolume * 0.35 : 0.08));
      const ambientGlow = ctx.createRadialGradient(
        centerX,
        centerY,
        baseRadius * 0.4,
        centerX,
        centerY,
        glowRadius * 1.5
      );
      ambientGlow.addColorStop(0, `hsla(${p.currentHue}, 90%, 65%, ${glowIntensity})`);
      ambientGlow.addColorStop(0.5, `hsla(${p.currentHue + 25}, 85%, 55%, ${glowIntensity * 0.4})`);
      ambientGlow.addColorStop(1, `hsla(${p.currentHue}, 80%, 50%, 0)`);

      ctx.fillStyle = ambientGlow;
      ctx.beginPath();
      ctx.arc(centerX, centerY, glowRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 6. Draw Thinking / Transcribing Quantum Vortex Rings
      if (state === 'thinking' || state === 'transcribing') {
        const ringCount = 3;
        for (let r = 0; r < ringCount; r++) {
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(p.time * (r % 2 === 0 ? 1.4 : -1.8) + (r * Math.PI) / ringCount);

          ctx.beginPath();
          ctx.ellipse(0, 0, baseRadius * 1.18, baseRadius * 0.45, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `hsla(${p.currentHue + r * 20}, 95%, 70%, 0.45)`;
          ctx.lineWidth = 1.8;
          ctx.setLineDash([12, 18]);
          ctx.stroke();
          ctx.restore();
        }
      }

      // 7. Draw Organic Fluid Blob (Layer 1 - Deep Core)
      const points = 48;
      const angleStep = (Math.PI * 2) / points;

      // Dynamic harmonic distortion parameters
      const harmonicAmplitude =
        state === 'listening'
          ? 4 + p.smoothedVolume * 22
          : state === 'speaking'
          ? 5 + Math.sin(p.time * 3) * 3
          : 3;

      ctx.save();
      ctx.beginPath();

      for (let i = 0; i <= points; i++) {
        const angle = i * angleStep;
        // Harmonic waves combination
        const wave1 = Math.sin(angle * 3 + p.time * 1.6);
        const wave2 = Math.cos(angle * 5 - p.time * 2.2);
        const wave3 = Math.sin(angle * 2 + p.time * 0.8);
        const totalWobble = (wave1 * 0.5 + wave2 * 0.35 + wave3 * 0.25) * harmonicAmplitude;

        const dynamicR = baseRadius + totalWobble;
        const x = centerX + Math.cos(angle) * dynamicR;
        const y = centerY + Math.sin(angle) * dynamicR;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.closePath();

      // Core Gradient with 3D spherical depth
      const coreGrad = ctx.createRadialGradient(
        centerX - baseRadius * 0.3,
        centerY - baseRadius * 0.35,
        baseRadius * 0.1,
        centerX,
        centerY,
        baseRadius * 1.1
      );

      if (state === 'listening') {
        coreGrad.addColorStop(0, '#A5F3FC'); // Bright cyan highlight
        coreGrad.addColorStop(0.25, '#22D3EE'); // Cyan body
        coreGrad.addColorStop(0.65, '#0891B2'); // Deep ocean
        coreGrad.addColorStop(1, '#083344'); // Dark edge
      } else if (state === 'speaking') {
        coreGrad.addColorStop(0, '#F5D0FE'); // Bright fuchsia light
        coreGrad.addColorStop(0.25, '#C084FC'); // Violet body
        coreGrad.addColorStop(0.65, '#7E22CE'); // Deep purple
        coreGrad.addColorStop(1, '#3B0764'); // Dark edge
      } else if (state === 'thinking' || state === 'transcribing') {
        coreGrad.addColorStop(0, '#E0E7FF'); // Indigo bright
        coreGrad.addColorStop(0.3, '#818CF8'); // Electric indigo
        coreGrad.addColorStop(0.7, '#4338CA'); // Deep cosmic
        coreGrad.addColorStop(1, '#1E1B4B');
      } else if (state === 'error') {
        coreGrad.addColorStop(0, '#FECDD3');
        coreGrad.addColorStop(0.3, '#F43F5E');
        coreGrad.addColorStop(0.7, '#9F1239');
        coreGrad.addColorStop(1, '#4C0519');
      } else if (state === 'interrupted') {
        coreGrad.addColorStop(0, '#FEF3C7');
        coreGrad.addColorStop(0.3, '#F59E0B');
        coreGrad.addColorStop(0.7, '#B45309');
        coreGrad.addColorStop(1, '#451A03');
      } else {
        // Idle: Hypnotic rich iridescent violet-cyan
        coreGrad.addColorStop(0, '#C4B5FD');
        coreGrad.addColorStop(0.3, '#8B5CF6');
        coreGrad.addColorStop(0.65, '#3B82F6');
        coreGrad.addColorStop(1, '#0F172A');
      }

      ctx.fillStyle = coreGrad;
      ctx.fill();

      // Outer rim luminous border
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = `hsla(${p.currentHue}, 90%, 80%, 0.5)`;
      ctx.stroke();
      ctx.restore();

      // 8. Draw Internal Swirling Liquid Plasma Highlight (Secondary Layer)
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const innerWobble = Math.sin(p.time * 2.5) * 8;
      const plasmaGrad = ctx.createRadialGradient(
        centerX + Math.cos(p.time * 1.5) * 20,
        centerY + Math.sin(p.time * 1.8) * 16,
        10,
        centerX,
        centerY,
        baseRadius * 0.85
      );
      plasmaGrad.addColorStop(0, `hsla(${p.currentHue + 30}, 100%, 75%, 0.6)`);
      plasmaGrad.addColorStop(0.6, `hsla(${p.currentHue - 20}, 90%, 60%, 0.25)`);
      plasmaGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = plasmaGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius * 0.82 + innerWobble * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 9. Glass Shell & Specular Highlights (Authentic 3D Frosted Crystal Look)
      ctx.save();

      // Top-Left Curved Glare (Gloss reflection)
      const glossGrad = ctx.createLinearGradient(
        centerX - baseRadius * 0.6,
        centerY - baseRadius * 0.8,
        centerX + baseRadius * 0.4,
        centerY
      );
      glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.7)');
      glossGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.2)');
      glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      ctx.fillStyle = glossGrad;
      ctx.beginPath();
      ctx.ellipse(
        centerX - baseRadius * 0.25,
        centerY - baseRadius * 0.42,
        baseRadius * 0.42,
        baseRadius * 0.2,
        -Math.PI / 6,
        0,
        Math.PI * 2
      );
      ctx.fill();

      // Bottom-Right Ambient Rim Bounce Light
      const bounceGrad = ctx.createRadialGradient(
        centerX + baseRadius * 0.45,
        centerY + baseRadius * 0.5,
        2,
        centerX + baseRadius * 0.45,
        centerY + baseRadius * 0.5,
        baseRadius * 0.4
      );
      bounceGrad.addColorStop(0, `hsla(${p.currentHue + 40}, 100%, 80%, 0.45)`);
      bounceGrad.addColorStop(1, 'transparent');

      ctx.fillStyle = bounceGrad;
      ctx.beginPath();
      ctx.arc(centerX + baseRadius * 0.35, centerY + baseRadius * 0.4, baseRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 10. Click Shockwave Ripple Animation
      if (p.shockwaveAlpha > 0.01) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, p.shockwaveRadius, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${p.currentHue}, 100%, 85%, ${p.shockwaveAlpha})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();

        p.shockwaveRadius += 4.5;
        p.shockwaveAlpha *= 0.91;
      }

      // 11. Speaking Harmonious Concentric Outer Sound Waves
      if (state === 'speaking') {
        const waveProgress = (p.time * 2) % 1;
        const waveR = baseRadius + waveProgress * 38;
        const waveAlpha = (1 - waveProgress) * 0.45;

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX, centerY, waveR, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(290, 95%, 70%, ${waveAlpha})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      }

      animRef.current = requestAnimationFrame(render);
    };

    animRef.current = requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [state, volume]);

  return (
    <div className="flex flex-col items-center justify-center select-none py-1">
      {/* Orb Stage with Frosted Glass Backdrop Aura */}
      <div className="relative flex items-center justify-center">
        {/* Ambient background refraction circle */}
        <div
          style={{ width: size, height: size }}
          className={`absolute rounded-full blur-2xl transition-all duration-700 pointer-events-none ${
            state === 'listening'
              ? 'bg-cyan-500/25 scale-110'
              : state === 'speaking'
              ? 'bg-fuchsia-500/25 scale-105'
              : state === 'thinking' || state === 'transcribing'
              ? 'bg-violet-500/25 scale-100 animate-pulse'
              : 'bg-violet-600/15 scale-95'
          }`}
        />

        {/* Outer Glass Ring Frame */}
        <div
          onClick={handleOrbClick}
          role="button"
          tabIndex={0}
          aria-label={`Voice Orb - Status: ${statusMeta.text}. Click to activate.`}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleOrbClick();
            }
          }}
          className="relative group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B0F17] rounded-full transition-transform duration-300 ease-out hover:scale-105 active:scale-95"
        >
          {/* Glass Lens Rim with Specular Sheen */}
          <div
            style={{ width: size, height: size }}
            className="rounded-full flex items-center justify-center relative overflow-hidden glass-pill border border-white/10 group-hover:border-white/25 shadow-[0_12px_40px_rgba(0,0,0,0.5)]"
          >
            {/* Real-time HTML5 60fps Canvas Fluid Sphere */}
            <canvas
              ref={canvasRef}
              style={{ width: size, height: size }}
              className="pointer-events-none"
              aria-hidden="true"
            />

            {/* Subtle Frosted Lens Reflection Overlay */}
            <div className="absolute inset-x-8 top-3 h-8 rounded-full bg-gradient-to-b from-white/10 to-transparent blur-[1px] pointer-events-none" />
          </div>
        </div>
      </div>

      {/* State Status Badge (Sleek Glass Pill) */}
      <div className="mt-3 flex flex-col items-center gap-1">
        <div
          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold tracking-wide border glass-pill transition-all duration-300 ${statusMeta.badgeBg}`}
        >
          <span className="relative flex h-2 w-2">
            {(state === 'listening' || state === 'speaking') && (
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusMeta.dotColor}`}
              />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${statusMeta.dotColor}`} />
          </span>

          <span className="uppercase text-[11px] tracking-wider font-mono">
            {statusMeta.text}
          </span>

          {state === 'thinking' || state === 'transcribing' ? (
            <Loader2 className="w-3 h-3 animate-spin text-current ml-0.5" />
          ) : state === 'listening' ? (
            <Radio className="w-3 h-3 text-cyan-300 animate-pulse ml-0.5" />
          ) : null}
        </div>

        <p className="text-[11px] text-[#94A3B8] font-medium tracking-normal text-center h-4 leading-4 truncate max-w-xs">
          {statusMeta.hint}
        </p>
      </div>
    </div>
  );
};
