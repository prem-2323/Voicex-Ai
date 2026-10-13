/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { X, Copy, Check, Terminal, ExternalLink } from 'lucide-react';
import { PYTHON_FASTAPI_BACKEND_CODE } from '../../config/apiConfig';

interface FastApiGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FastApiGuideModal: React.FC<FastApiGuideModalProps> = ({ isOpen, onClose }) => {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (!isOpen) return null;

  const installCmd = 'pip install fastapi uvicorn websockets numpy torch';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(PYTHON_FASTAPI_BACKEND_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(installCmd);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-[#141C2B] border border-[#273247] rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-[#273247] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded bg-[#8B5CF6]/20 text-[#8B5CF6]">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-semibold text-[#F1F5F9]">
                FastAPI Local Inference Integration
              </h3>
              <p className="text-[11px] text-[#94A3B8]">
                Spin up your local open-weight server in under 2 minutes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-[#94A3B8] hover:text-[#F1F5F9] rounded transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs text-[#94A3B8]">
          <div>
            <p className="text-[#F1F5F9] font-medium mb-1">1. Install Dependencies</p>
            <div className="bg-[#0B0F17] border border-[#273247] rounded-md p-2.5 flex items-center justify-between font-mono text-[#22D3EE] text-[11px]">
              <code>{installCmd}</code>
              <button
                onClick={handleCopyCmd}
                className="p-1 hover:text-white transition-colors"
                title="Copy command"
              >
                {copiedCmd ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-[#F1F5F9] font-medium">2. Run Local Python Server (server.py)</p>
              <button
                onClick={handleCopyCode}
                className="flex items-center gap-1 text-[11px] text-[#8B5CF6] hover:underline"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-[#22C55E]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied script' : 'Copy Python script'}</span>
              </button>
            </div>
            <pre className="bg-[#0B0F17] border border-[#273247] rounded-md p-3 overflow-x-auto text-[11px] font-mono text-slate-300 leading-relaxed max-h-52">
              {PYTHON_FASTAPI_BACKEND_CODE}
            </pre>
          </div>

          <div className="p-3 bg-[#0E1420] border border-[#273247] rounded-md">
            <p className="font-semibold text-[#8B5CF6] mb-0.5">Real-time Turn Protocol</p>
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              When your Python server starts on <code className="text-[#22D3EE] font-mono">http://localhost:8000</code>, VoiceX AI automatically connects over WebSocket to stream Whisper transcripts and Kokoro audio packets with sub-350ms latency.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-[#273247] bg-[#0E1420] flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white rounded-md text-xs font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
