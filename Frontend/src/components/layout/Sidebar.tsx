/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Mic2,
  Plus,
  History,
  Activity,
  Settings,
  ShieldCheck,
  ChevronRight,
  MessageSquare,
  Trash2,
} from 'lucide-react';
import { useVoice, TabScreen } from '../../context/VoiceContext';

interface SidebarProps {
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpenMobile = false, onCloseMobile }) => {
  const {
    activeScreen,
    setActiveScreen,
    createNewConversation,
    conversations,
    activeConversation,
    loadConversation,
    deleteConversation,
  } = useVoice();

  const navItems: { id: TabScreen; label: string; icon: React.ReactNode }[] = [
    { id: 'workspace', label: 'Voice Workspace', icon: <Mic2 className="w-4 h-4" /> },
    { id: 'history', label: 'Conversation History', icon: <History className="w-4 h-4" /> },
    { id: 'performance', label: 'Performance Lab', icon: <Activity className="w-4 h-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" /> },
  ];

  const handleNavClick = (screen: TabScreen) => {
    setActiveScreen(screen);
    onCloseMobile?.();
  };

  const handleNewConversation = () => {
    createNewConversation();
    setActiveScreen('workspace');
    onCloseMobile?.();
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Desktop compact 232px sidebar */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-[232px] h-full bg-[#0E1420] border-r border-[#273247] flex flex-col justify-between shrink-0 select-none transition-transform duration-200 ease-in-out md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top brand & New conversation */}
        <div className="p-4 border-b border-[#273247]/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#8B5CF6] flex items-center justify-center shadow-xs">
              <span className="font-bold text-white text-xs tracking-tight">VX</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm tracking-tight text-[#F1F5F9]">VoiceX AI</span>
                <span className="text-[9px] font-mono uppercase px-1 py-0.2 rounded bg-[#192335] text-[#22D3EE] border border-[#273247]">
                  LOCAL
                </span>
              </div>
              <p className="text-[10px] text-[#94A3B8] truncate">Open-Weight Assistant</p>
            </div>
          </div>

          {/* New Conversation Button - compact & prominent */}
          <button
            onClick={handleNewConversation}
            className="w-full mt-3.5 px-3 py-2 rounded-lg bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-colors shadow-xs active:scale-98"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Conversation</span>
          </button>
        </div>

        {/* Navigation links & recent sessions */}
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive = activeScreen === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-[#141C2B] text-[#F1F5F9] border border-[#273247]'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#141C2B]/60'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={isActive ? 'text-[#8B5CF6]' : 'text-[#94A3B8]'}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-3 h-3 text-[#8B5CF6]" />}
                </button>
              );
            })}
          </nav>

          {/* Recent sessions section */}
          <div className="pt-3 border-t border-[#273247]/60">
            <div className="px-2 pb-1.5 flex items-center justify-between text-[10px] text-[#94A3B8] font-medium uppercase tracking-wider">
              <span>Recent Sessions</span>
              <span className="font-mono tabular-nums text-[10px]">{conversations.length}</span>
            </div>

            <div className="space-y-0.5">
              {conversations.slice(0, 6).map((conv) => {
                const isCurrent = activeConversation?.id === conv.id;
                return (
                  <div
                    key={conv.id}
                    className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-[#141C2B] text-[#F1F5F9] border border-[#273247]'
                        : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-[#141C2B]/40'
                    }`}
                    onClick={() => {
                      loadConversation(conv.id);
                      onCloseMobile?.();
                    }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MessageSquare className="w-3 h-3 shrink-0 opacity-60" />
                      <span className="truncate text-[11px]">{conv.title}</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 text-[#94A3B8] hover:text-rose-400 transition-opacity"
                      title="Delete session"
                      aria-label="Delete session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Compact privacy footer */}
        <div className="p-3 border-t border-[#273247] bg-[#0E1420]">
          <div className="flex items-center gap-2 text-xs text-[#94A3B8]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#22C55E] shrink-0" />
            <span className="text-[11px] text-[#94A3B8]">
              Local inference · Zero cloud telemetry
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
