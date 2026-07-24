const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

/** Send a raw crisis report to the backend for Gemini triage + storage. */
export async function triageReport(rawText) {
  const res = await fetch(`${API_BASE}/api/triage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText }),
  });
  if (!res.ok) {
    let detail = `Server responded ${res.status}`;
    try {
      const body = await res.json();
      if (body.detail) detail = body.detail;
    } catch {
      /* ignore non-JSON error bodies */
    }
    throw new Error(detail);
  }
  return res.json();
}

/** Fetch all stored crisis reports, newest first. */
export async function getReports() {
  const res = await fetch(`${API_BASE}/api/reports`);
  if (!res.ok) throw new Error(`Server responded ${res.status}`);
  return res.json();
}
