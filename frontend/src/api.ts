const API_BASE =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

/**
 * TODO (candidate):
 * - Implement POST /triage call
 * - Handle non-200 responses
 */
export async function postTriage(text: string) {
  const res = await fetch(`${API_BASE}/triage`, {
    method: "POST",
    headers: {
      "Content-Type": "applivation/json"
    },
    body: JSON.stringify({text})
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Faild to triage message")
  }

  return res.json();
}

/**
 * TODO (candidate):
 * - Implement GET /triage?limit=10
 * - Return parsed JSON
 */
export async function getRecent(limit = 10) {
  const res = await fetch(`${API_BASE}/triage?limit=${limit}`);

  if (!res.ok){
    throw new Error("Failed to fetch recent triages")
  }
  return res.json();
}
