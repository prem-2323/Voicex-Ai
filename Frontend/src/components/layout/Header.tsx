/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { RefreshCw, Edit2, Check, Radio } from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';

interface HeaderProps {
  onOpenFastApiGuide: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenFastApiGuide }) => {
  const {
    activeConversation,
    backendStatus,
    testBackendConnection,
    renameConversation,
  } = useVoice();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');

  const currentTitle = activeConversation?.title || 'Voice Workspace';

  const handleStartEdit = () => {
    setTitleInput(currentTitle);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (activeConversation && titleInput.trim()) {
      renameConversation(activeConversation.id, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <header className="h-14 border-b border-[#273247] bg-[#0B0F17] px-4 md:px-6 flex items-center justify-between gap-4 select-none shrink-0 z-10">
      {/* Zone 1: Current conversation title */}
      <div className="flex items-center gap-2.5 min-w-0">
        {isEditingTitle ? (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={titleInput}
              onChange={(e) => setTitleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveTitle();
                if (e.key === 'Escape') setIsEditingTitle(false);
              }}
              autoFocus
              className="bg-[#141C2B] border border-[#8B5CF6] rounded px-2 py-0.5 text-xs text-[#F1F5F9] focus:outline-none"
            />
            <button
              onClick={handleSaveTitle}
              className="p-1 text-[#22C55E] hover:opacity-80"
              aria-label="Save title"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group min-w-0">
            <h1 className="text-xs md:text-sm font-medium text-[#F1F5F9] truncate max-w-[200px] sm:max-w-xs md:max-w-sm">
              {currentTitle}
            </h1>
            <button
              onClick={handleStartEdit}
              className="opacity-0 group-hover:opacity-100 p-1 text-[#94A3B8] hover:text-[#F1F5F9] transition-opacity"
              title="Edit session title"
              aria-label="Edit session title"
            >
              <Edit2 className="w-3 h-3" />
            </button>
          </div>
        )}

        <span className="hidden lg:inline text-xs text-[#94A3B8]" aria-hidden="true">
          ·
        </span>
        <span className="hidden lg:inline text-xs text-[#94A3B8] font-mono tabular-nums">
          Whisper-v3 · Llama-3.2 · Kokoro
        </span>
      </div>

      {/* Zone 2: Backend status & Controls */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Backend status indicator */}
        <div className="flex items-center gap-2 text-xs">
          {backendStatus.online ? (
            <div className="flex items-center gap-1.5 text-[#22C55E] bg-[#22C55E]/10 border border-[#22C55E]/20 px-2 py-0.5 rounded-md text-[11px] font-medium">
              <Radio className="w-3 h-3" />
              <span>FastAPI Connected</span>
              <span className="text-[#94A3B8] font-mono tabular-nums">
                ({backendStatus.latencyTestMs}ms)
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-[#22D3EE] bg-[#22D3EE]/10 border border-[#22D3EE]/20 px-2 py-0.5 rounded-md text-[11px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22D3EE]" />
              <span>Preview Mode</span>
            </div>
          )}

          <button
            onClick={() => testBackendConnection()}
            className="p-1 text-[#94A3B8] hover:text-[#F1F5F9] transition-colors rounded hover:bg-[#141C2B]"
            title="Ping backend health endpoint"
            aria-label="Ping backend"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
        </div>

        {/* Backend Setup Modal Trigger */}
        <button
          onClick={onOpenFastApiGuide}
          className="text-[11px] font-medium px-2.5 py-1 text-[#F1F5F9] bg-[#141C2B] hover:bg-[#192335] border border-[#273247] rounded-md transition-colors"
        >
          Backend Setup
        </button>
      </div>
    </header>
  );
};
