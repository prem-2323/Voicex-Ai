/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VoiceProvider, useVoice } from './context/VoiceContext';
import { Header } from './components/layout/Header';
import { WorkspaceView } from './components/workspace/WorkspaceView';
import { ConversationHistoryView } from './components/history/ConversationHistoryView';

const MainShell: React.FC = () => {
  const { activeScreen } = useVoice();

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0B0F17] text-[#F1F5F9]">
      {/* Global Clean Glass Header */}
      <Header />

      {/* Main Viewport Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden relative">
        {activeScreen === 'history' ? (
          <ConversationHistoryView />
        ) : (
          <WorkspaceView />
        )}
      </main>
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
