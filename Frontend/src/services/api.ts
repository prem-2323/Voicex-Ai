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
    const filename = audioFile.type.includes("wav") ? "recording.wav" : "recording.webm";
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

  return data.transcription;
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
