const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

export async function checkBackendHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  return response.json();
}

export async function getModelStatus() {
  const response = await fetch(`${API_BASE_URL}/api/models`);

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  return response.json();
}

export async function transcribeAudio(audioFile: File | Blob) {
  const formData = new FormData();
  if (audioFile instanceof File) {
    formData.append("file", audioFile);
  } else {
    const filename =
      audioFile.type && audioFile.type.includes("wav")
        ? "recording.wav"
        : audioFile.type && audioFile.type.includes("ogg")
        ? "recording.ogg"
        : "recording.webm";
    formData.append("file", audioFile, filename);
  }

  const response = await fetch(`${API_BASE_URL}/api/transcribe`, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "Speech transcription failed");
  }

  return {
    ...data,
    text: (data.text || data.transcription?.text || "") as string,
  };
}

export async function sendChatMessage(
  message: string,
  history: Array<{ role: "user" | "assistant"; content: string }> = [],
  sessionId?: string
) {
  const body: Record<string, unknown> = { message, history };
  if (sessionId) {
    body.session_id = sessionId;
  }
  const response = await fetch(`${API_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.detail || "LLM request failed");
  }

  return data;
}

export async function synthesizeSpeech(
  text: string,
  voice = "en-US-AriaNeural"
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/api/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, voice }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Voice generation failed");
  }

  return response.blob();
}

export async function speakResponse(
  text: string,
  voice = "en-US-AriaNeural"
): Promise<HTMLAudioElement> {
  const audioBlob = await synthesizeSpeech(text, voice);
  const audioUrl = URL.createObjectURL(audioBlob);
  const audio = new Audio(audioUrl);

  audio.onended = () => URL.revokeObjectURL(audioUrl);
  audio.onerror = () => URL.revokeObjectURL(audioUrl);

  await audio.play();
  return audio;
}

export async function getBackendTelemetry() {
  const response = await fetch(`${API_BASE_URL}/api/performance/telemetry`);
  if (!response.ok) {
    throw new Error(`Telemetry failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function runPipelineBenchmark() {
  const response = await fetch(`${API_BASE_URL}/api/performance/benchmark`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Benchmark failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchConversations() {
  const response = await fetch(`${API_BASE_URL}/api/conversations`);
  if (!response.ok) {
    throw new Error(`Fetch conversations failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function createConversationSession(sessionId: string, title?: string) {
  const response = await fetch(`${API_BASE_URL}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, title }),
  });
  if (!response.ok) {
    throw new Error(`Create conversation failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function renameConversationSession(sessionId: string, title: string) {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error(`Rename conversation failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function deleteConversationSession(sessionId: string) {
  const response = await fetch(`${API_BASE_URL}/api/conversations/${sessionId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Delete conversation failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function clearAllConversationSessions() {
  const response = await fetch(`${API_BASE_URL}/api/conversations`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Clear conversations failed with HTTP ${response.status}`);
  }
  return response.json();
}

export async function getAvailableVoices() {
  const response = await fetch(`${API_BASE_URL}/api/tts/voices`);
  if (!response.ok) {
    throw new Error(`Get voices failed with HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * End-to-end voice processing reference workflow (Phase 5 Step 3)
 */
export async function processVoice(
  audioBlob: Blob,
  conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [],
  voice = "en-US-AriaNeural"
): Promise<{ transcript: string; answer: string; audio: HTMLAudioElement }> {
  // Step 1: Upload recorded audio
  const sttData = await transcribeAudio(audioBlob);
  const transcript = sttData.text;

  if (!transcript || !transcript.trim()) {
    throw new Error("No speech detected");
  }

  // Step 2: Send transcript to Qwen
  const chatData = await sendChatMessage(transcript, conversationHistory);
  const answer = chatData.response;

  // Step 3 & 4: Convert AI answer into audio and play
  const audio = await speakResponse(answer, voice);

  return { transcript, answer, audio };
}


