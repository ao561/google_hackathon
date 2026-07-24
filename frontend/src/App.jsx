import { useState, useCallback } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import UserPage from "./pages/UserPage.jsx";
import ResponderPage from "./pages/ResponderPage.jsx";
import "./App.css";

const API_URL = "http://localhost:8000/api/triage";

const SAMPLE_TEXT = `Wildfire spreading fast north of Los Angeles, evacuations ordered.
Heavy monsoon flooding across Karachi, thousands displaced.
Drought worsening around Nairobi, food shortages reported.
Moderate earthquake felt in Tokyo overnight.
Heatwave advisory issued for Madrid, cooling centers open.`;

export default function App() {
  const [rawText, setRawText] = useState(SAMPLE_TEXT);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  const analyze = useCallback(async () => {
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
  }, [rawText]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="pulse" />
          <div>
            <h1>AI Crisis Triage Mapper</h1>
            <p className="tagline">
              Extract &amp; prioritize crisis events, visualized on a live globe.
            </p>
          </div>
        </div>
      </header>

      <div className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/user" replace />} />
          <Route
            path="/user"
            element={
              <UserPage
                rawText={rawText}
                setRawText={setRawText}
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
          <Route path="*" element={<Navigate to="/user" replace />} />
        </Routes>
      </div>
    </div>
  );
}
