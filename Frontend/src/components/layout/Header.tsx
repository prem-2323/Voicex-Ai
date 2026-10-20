/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Edit2,
  Check,
  Mic2,
  History,
  Plus,
} from 'lucide-react';
import { useVoice, TabScreen } from '../../context/VoiceContext';
import { VoiceXLogo } from '../brand/VoiceXLogo';

interface HeaderProps {
  onOpenFastApiGuide?: () => void;
}

export const Header: React.FC<HeaderProps> = () => {
  const {
    activeScreen,
    setActiveScreen,
    createNewConversation,
    activeConversation,
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

  const navItems: { id: TabScreen; label: string; icon: React.ReactNode }[] = [
    { id: 'workspace', label: 'Workspace', icon: <Mic2 className="w-3.5 h-3.5" /> },
    { id: 'history', label: 'History', icon: <History className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="h-14 border-b border-white/10 glass-panel bg-slate-950/70 px-4 md:px-6 flex items-center justify-between gap-4 select-none shrink-0 z-20">
      {/* Zone 1: Brand & Session Title */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Brand Icon */}
        <div className="flex items-center gap-2">
          <VoiceXLogo
            size={28}
            className="shrink-0 rounded-lg shadow-md shadow-violet-900/30"
          />
          <span className="font-semibold text-sm tracking-tight text-[#F1F5F9] hidden sm:inline">
            VoiceX AI
          </span>
        </div>

        <span className="text-[#94A3B8]/40 hidden sm:inline" aria-hidden="true">
          |
        </span>

        {/* Current conversation title */}
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
          <div className="flex items-center gap-1.5 group min-w-0">
            <h1 className="text-xs md:text-sm font-medium text-[#94A3B8] group-hover:text-[#F1F5F9] truncate max-w-[140px] sm:max-w-xs transition-colors">
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
      </div>

      {/* Zone 2: Top Navigation Switcher (Workspace & History) */}
      <nav className="flex items-center glass-pill rounded-lg p-0.5 border border-white/10">
        {navItems.map((item) => {
          const isActive = activeScreen === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveScreen(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                isActive
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5'
              }`}
            >
              {item.icon}
              <span className="hidden md:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Zone 3: New Chat Action */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          onClick={() => {
            createNewConversation();
            setActiveScreen('workspace');
          }}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 text-white bg-violet-600 hover:bg-violet-500 rounded-md shadow-sm transition-all active:scale-95"
          title="Start new voice session"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Chat</span>
        </button>
      </div>
    </header>
  );
};
