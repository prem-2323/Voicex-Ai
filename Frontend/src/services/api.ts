const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

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
