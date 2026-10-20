/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useId } from 'react';

interface VoiceXLogoProps {
  size?: number;
  className?: string;
}

/**
 * VoiceX AI brand mark: a voice waveform inside a glowing glass tile.
 * The waveform doubles as the app icon and favicon.
 */
export const VoiceXLogo: React.FC<VoiceXLogoProps> = ({
  size = 28,
  className = '',
}) => {
  const reactId = useId();
  const uid = reactId.replace(/[^a-zA-Z0-9_-]/g, '');
  const gradientId = `vx-gradient-${uid}`;
  const waveId = `vx-wave-${uid}`;
  const glowId = `vx-glow-${uid}`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient
          id={gradientId}
          x1="6"
          y1="4"
          x2="58"
          y2="60"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#C4B5FD" />
          <stop offset="0.45" stopColor="#8B5CF6" />
          <stop offset="0.75" stopColor="#22D3EE" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>

        <linearGradient
          id={waveId}
          x1="16"
          y1="10"
          x2="48"
          y2="54"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#E0E7FF" />
          <stop offset="1" stopColor="#A5F3FC" />
        </linearGradient>

        <radialGradient
          id={glowId}
          cx="32"
          cy="32"
          r="26"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#8B5CF6" stopOpacity="0.42" />
          <stop offset="0.55" stopColor="#22D3EE" stopOpacity="0.16" />
          <stop offset="1" stopColor="#22D3EE" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Dark glass tile */}
      <rect width="64" height="64" rx="16" fill="#0B0F17" />
      <rect
        x="1.25"
        y="1.25"
        width="61.5"
        height="61.5"
        rx="14.75"
        fill={`url(#${gradientId})`}
        fillOpacity="0.16"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.5"
      />

      {/* Soft inner glow and top-left sheen */}
      <circle cx="32" cy="32" r="26" fill={`url(#${glowId})`} />
      <ellipse
        cx="20"
        cy="14"
        rx="22"
        ry="11"
        transform="rotate(-18 20 14)"
        fill="white"
        fillOpacity="0.06"
      />

      {/* Voice waveform */}
      <g fill={`url(#${waveId})`}>
        <rect x="13.25" y="26" width="4.5" height="12" rx="2.25" />
        <rect x="21.5" y="19" width="4.5" height="26" rx="2.25" />
        <rect x="29.75" y="11" width="4.5" height="42" rx="2.25" />
        <rect x="38" y="18" width="4.5" height="28" rx="2.25" />
        <rect x="46.25" y="25" width="4.5" height="14" rx="2.25" />
      </g>

      {/* Live listening accent */}
      <circle cx="47.5" cy="16.5" r="2.25" fill="#22D3EE" fillOpacity="0.9" />
    </svg>
  );
};
