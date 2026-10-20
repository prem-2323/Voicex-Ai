/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Search,
  Trash2,
  ExternalLink,
  Download,
  Edit2,
  Check,
  Globe,
  Clock,
  AlertTriangle,
  MessageSquare,
  X,
} from 'lucide-react';
import { useVoice } from '../../context/VoiceContext';
import { Conversation } from '../../types/voice';

export const ConversationHistoryView: React.FC = () => {
  const {
    conversations,
    loadConversation,
    deleteConversation,
    renameConversation,
    clearAllConversations,
    createNewConversation,
    backendStatus,
  } = useVoice();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguageFilter, setSelectedLanguageFilter] = useState<'all' | 'en' | 'hi'>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitleText, setEditTitleText] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filter conversations
  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      const matchesSearch =
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.messages.some((m) => m.content.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesLang =
        selectedLanguageFilter === 'all' ||
        c.primaryLanguage === selectedLanguageFilter ||
        c.messages.some(
          (m) =>
            (selectedLanguageFilter === 'hi' && m.detectedLanguage === 'Hindi') ||
            (selectedLanguageFilter === 'en' && m.detectedLanguage === 'English')
        );

      return matchesSearch && matchesLang;
    });
  }, [conversations, searchQuery, selectedLanguageFilter]);

  const exportConversation = (conv: Conversation) => {
    const dataStr =
      'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(conv, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${conv.title.replace(/\s+/g, '_')}_transcript.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleStartRename = (conv: Conversation) => {
    setEditingId(conv.id);
    setEditTitleText(conv.title);
  };

  const handleSaveRename = (id: string) => {
    if (editTitleText.trim()) {
      renameConversation(id, editTitleText.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6 max-w-5xl mx-auto w-full bg-[#0B0F17]">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#273247]">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg md:text-xl font-bold text-[#F1F5F9]">Conversation History</h2>
            <span
              className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                backendStatus.online
                  ? 'bg-[#22C55E]/10 text-[#22C55E] border-[#22C55E]/30'
                  : 'bg-[#192335] text-[#22D3EE] border-[#273247]'
              }`}
            >
              {backendStatus.online ? 'FastAPI Synced' : 'Local Storage'}
            </span>
          </div>
          <p className="text-xs text-[#94A3B8] mt-0.5">
            Search, reopen, rename, or export local voice interactions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {conversations.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="px-2.5 py-1 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-md transition-colors flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear History</span>
            </button>
          )}

          <button
            onClick={createNewConversation}
            className="px-3 py-1 text-xs font-medium text-white bg-[#8B5CF6] hover:bg-[#7C3AED] rounded-md transition-colors flex items-center gap-1.5 shadow-xs"
          >
            <span>New Session</span>
          </button>
        </div>
      </div>

      {/* Confirmation banner for clearing all history */}
      {showClearConfirm && (
        <div className="mt-3 p-3 bg-rose-950/40 border border-rose-800/50 rounded-lg flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-rose-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Delete all {conversations.length} stored conversation sessions? This action cannot be undone.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowClearConfirm(false)}
              className="px-2.5 py-1 rounded bg-[#141C2B] text-slate-300 hover:bg-[#192335]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                clearAllConversations();
                setShowClearConfirm(false);
              }}
              className="px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-500 font-medium"
            >
              Yes, Clear All
            </button>
          </div>
        </div>
      )}

      {/* Confirmation modal for single item deletion */}
      {deletingId && (
        <div className="mt-3 p-3 bg-[#141C2B] border border-rose-500/30 rounded-lg flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-rose-300">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Are you sure you want to delete this session?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDeletingId(null)}
              className="px-2.5 py-1 rounded bg-[#192335] text-[#94A3B8] hover:text-[#F1F5F9]"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                deleteConversation(deletingId);
                setDeletingId(null);
              }}
              className="px-2.5 py-1 rounded bg-rose-600 text-white hover:bg-rose-500 font-medium"
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#94A3B8] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transcripts or titles..."
            className="w-full bg-[#141C2B] border border-[#273247] rounded-md pl-8 pr-3 py-1.5 text-xs text-[#F1F5F9] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#8B5CF6]"
          />
        </div>

        {/* Language Filter */}
        <div className="flex items-center bg-[#141C2B] border border-[#273247] rounded-md p-0.5 text-xs">
          <button
            onClick={() => setSelectedLanguageFilter('all')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              selectedLanguageFilter === 'all'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#94A3B8] hover:text-[#F1F5F9]'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setSelectedLanguageFilter('en')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              selectedLanguageFilter === 'en'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#94A3B8] hover:text-[#F1F5F9]'
            }`}
          >
            English
          </button>
          <button
            onClick={() => setSelectedLanguageFilter('hi')}
            className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
              selectedLanguageFilter === 'hi'
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#94A3B8] hover:text-[#F1F5F9]'
            }`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* Compact Conversation Rows */}
      <div className="mt-4 border border-[#273247] rounded-lg overflow-hidden bg-[#0E1420]">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center bg-[#141C2B]/50">
            <MessageSquare className="w-6 h-6 text-[#94A3B8]/50 mx-auto mb-2" />
            <h3 className="text-xs font-semibold text-[#F1F5F9]">No conversations found</h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {searchQuery
                ? 'No sessions matched your query. Clear the search input to see all.'
                : 'Start a voice session in the Workspace to begin.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#273247]/60">
            {filteredConversations.map((conv) => {
              const hasHindi = conv.messages.some(
                (m) => m.detectedLanguage === 'Hindi' || /[\u0900-\u097F]/.test(m.content)
              );
              const messageCount = conv.messages.length;
              const previewMsg = conv.messages[conv.messages.length - 1]?.content || 'Empty session';
              const isEditing = editingId === conv.id;

              return (
                <div
                  key={conv.id}
                  className="p-3 hover:bg-[#141C2B] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs group"
                >
                  {/* Left Column: Title & Preview */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editTitleText}
                            onChange={(e) => setEditTitleText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRename(conv.id);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            className="bg-[#192335] border border-[#8B5CF6] rounded px-2 py-0.5 text-xs text-[#F1F5F9] focus:outline-none"
                          />
                          <button
                            onClick={() => handleSaveRename(conv.id)}
                            className="p-1 text-[#22C55E]"
                            title="Save"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="p-1 text-[#94A3B8]"
                            title="Cancel"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="font-semibold text-[#F1F5F9] truncate group-hover:text-[#8B5CF6] transition-colors">
                            {conv.title}
                          </span>
                          <button
                            onClick={() => handleStartRename(conv)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-[#94A3B8] hover:text-[#F1F5F9] transition-opacity"
                            title="Rename session"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}

                      <span className="text-[#94A3B8]" aria-hidden="true">·</span>
                      <span className="text-[11px] text-[#22D3EE] flex items-center gap-1 shrink-0">
                        <Globe className="w-3 h-3" />
                        <span>{hasHindi ? 'Hindi / EN' : 'English'}</span>
                      </span>
                    </div>

                    {/* Excerpt preview */}
                    <p className="text-[11px] text-[#94A3B8] truncate mt-1 leading-normal max-w-xl">
                      {previewMsg}
                    </p>
                  </div>

                  {/* Right Column: Metadata & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-3 shrink-0 text-[11px] text-[#94A3B8]">
                    <div className="flex items-center gap-2 font-mono tabular-nums">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatDate(conv.updatedAt)}</span>
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{messageCount} turns</span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1.5 ml-2">
                      <button
                        onClick={() => exportConversation(conv)}
                        className="p-1 text-[#94A3B8] hover:text-[#F1F5F9] rounded hover:bg-[#192335] transition-colors"
                        title="Export transcript as JSON"
                        aria-label="Export JSON"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => setDeletingId(conv.id)}
                        className="p-1 text-[#94A3B8] hover:text-rose-400 rounded hover:bg-[#192335] transition-colors"
                        title="Delete session"
                        aria-label="Delete session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => loadConversation(conv.id)}
                        className="px-2.5 py-1 bg-[#192335] hover:bg-[#223048] text-[#F1F5F9] border border-[#273247] rounded font-medium flex items-center gap-1 transition-colors text-[11px]"
                      >
                        <ExternalLink className="w-3 h-3 text-[#8B5CF6]" />
                        <span>Open</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
