/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { VoiceProvider, useVoice } from './context/VoiceContext';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { ConversationHistoryView } from './components/history/ConversationHistoryView';
import { PerformanceLabView } from './components/performance/PerformanceLabView';
import { SettingsView } from './components/settings/SettingsView';
import { FastApiGuideModal } from './components/modals/FastApiGuideModal';
import { Menu, X } from 'lucide-react';

const MainShell: React.FC = () => {
  const { activeScreen } = useVoice();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0B0F17] text-[#F1F5F9]">
      {/* Compact 232px Sidebar Navigation */}
      <Sidebar
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Viewport Content Area */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        {/* Mobile top strip with hamburger button */}
        <div className="md:hidden flex items-center justify-between px-3.5 py-2.5 border-b border-[#273247] bg-[#0E1420]">
          <button
            onClick={() => setIsMobileMenuOpen((p) => !p)}
            className="p-1.5 text-[#94A3B8] hover:text-[#F1F5F9] rounded-md bg-[#141C2B] border border-[#273247]"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-xs tracking-tight text-[#F1F5F9]">VoiceX AI</span>
            <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-[#192335] text-[#22D3EE] border border-[#273247]">
              LOCAL
            </span>
          </div>
          <div className="w-6" />
        </div>

        {/* Global Workspace Header */}
        <Header onOpenFastApiGuide={() => setIsGuideModalOpen(true)} />

        {/* Screen Routing */}
        <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
          {activeScreen === 'workspace' && <WorkspaceView />}
          {activeScreen === 'history' && <ConversationHistoryView />}
          {activeScreen === 'performance' && <PerformanceLabView />}
          {activeScreen === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Local Backend Integration Guide Modal */}
      <FastApiGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <VoiceProvider>
      <MainShell />
    </VoiceProvider>
  );
}
