import { useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import UserPage from "./pages/UserPage.jsx";
import NewsPage from "./pages/NewsPage.jsx";
import ResponderPage from "./pages/ResponderPage.jsx";
import "./App.css";

const API_URL =
  import.meta.env.VITE_TRIAGE_API_URL ??
  "http://localhost:8000/api/triage";

export default function App() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const analyze = useCallback(async (rawText) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: rawText }),
      });
      if (!res.ok) throw new Error(`Server responded ${res.status}`);
      const data = await res.json();
      setEvents(data);
      setSubmitted(true);
    } catch (e) {
      setError(e.message || "Failed to reach the backend.");
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="shell">
      <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/user" replace />} />
          <Route
            path="/user"
            element={
              <UserPage
                analyze={analyze}
                loading={loading}
                error={error}
                submitted={submitted}
                eventCount={events.length}
              />
            }
          />
          <Route
            path="/responder"
            element={<ResponderPage events={events} />}
          />
          <Route path="/news" element={<NewsPage />} />
          <Route path="*" element={<Navigate to="/user" replace />} />
        </Routes>
      </div>
    </div>
  );
}
