import { useState, useRef, useEffect } from "react";
import { triageReport } from "../api.js";

// Hardcoded mock news feed shown at the top of the reporter page.
const NEWS = [
  {
    tag: "WILDFIRE",
    headline: "Fast-moving brush fire prompts evacuations north of the city",
    summary:
      "Crews battle a wind-driven wildfire threatening hillside neighborhoods. Residents in three zones told to leave immediately.",
    time: "18 min ago",
  },
  {
    tag: "FLOODING",
    headline: "Record monsoon rains overwhelm coastal drainage systems",
    summary:
      "Rising floodwaters have cut off several districts. Rescue boats deployed as thousands seek higher ground.",
    time: "1 hr ago",
  },
  {
    tag: "SEISMIC",
    headline: "Magnitude 5.4 quake rattles region; aftershocks expected",
    summary:
      "Structural inspections underway across the metro area. No major casualties reported so far.",
    time: "2 hr ago",
  },
];

const colorForUrgency = (u) => (u > 7 ? "#ff0044" : "#ffe600");

export default function UserPage() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState([]); // reports sent this session
  const [listening, setListening] = useState(false);

  const recognitionRef = useRef(null);
  const [voiceSupported, setVoiceSupported] = useState(false);

  // Set up the Web Speech API once, if the browser supports it.
  useEffect(() => {
    const SR =
      window.SpeechRecognition || window.webkitSpeechRecognition || null;
    if (!SR) return;
    setVoiceSupported(true);

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    let finalTranscript = "";
    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += chunk + " ";
        else interim += chunk;
      }
      setText((base) => {
        // Replace from the anchor we stored when recording started.
        const anchor = recognition._anchor ?? base;
        return (anchor + " " + finalTranscript + interim).trimStart();
      });
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    return () => recognition.abort();
  }, []);

  const toggleVoice = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition._anchor = text ? text + " " : "";
      try {
        recognition.start();
        setListening(true);
      } catch {
        /* start() throws if already started; ignore */
      }
    }
  };

  const send = async () => {
    const payload = text.trim();
    if (!payload || loading) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
    }
    setLoading(true);
    setError(null);
    try {
      const report = await triageReport(payload);
      setSubmitted((prev) => [report, ...prev]);
      setText("");
    } catch (e) {
      setError(e.message || "Failed to reach the backend.");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  };

  return (
    <section className="user-view">
      <div className="user-inner">
        {/* Mock news feed */}
        <div className="news">
          <span className="section-eyebrow">Live newswire</span>
          <div className="news-grid">
            {NEWS.map((n, i) => (
              <article className="news-card" key={i}>
                <div className="news-top">
                  <span className="news-tag">{n.tag}</span>
                  <span className="news-time">{n.time}</span>
                </div>
                <h3>{n.headline}</h3>
                <p>{n.summary}</p>
              </article>
            ))}
          </div>
        </div>

        {/* Reporter composer */}
        <div className="composer-block">
          <span className="section-eyebrow">Report a crisis</span>
          <p className="composer-hint">
            Describe what's happening in your own words — type or use voice. Our
            AI extracts the location, urgency, and key details for responders.
          </p>

          <div className="composer">
            <textarea
              className="composer-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="e.g. My name is Ana, I'm 30. There's a gas leak on Oak Street in Berlin and two people are trapped inside…"
              rows={3}
              spellCheck={false}
            />
            <div className="composer-actions">
              {voiceSupported ? (
                <button
                  className={`mic ${listening ? "recording" : ""}`}
                  onClick={toggleVoice}
                  title={listening ? "Stop recording" : "Start voice input"}
                  type="button"
                >
                  {listening ? "● Recording…" : "🎤 Voice"}
                </button>
              ) : (
                <span className="mic-unsupported" title="Try Chrome or Edge">
                  🎤 Voice unavailable
                </span>
              )}
              <button
                className="send"
                onClick={send}
                disabled={loading || !text.trim()}
                type="button"
              >
                {loading ? "Analyzing…" : "Send ▸"}
              </button>
            </div>
          </div>
          <div className="composer-foot">
            <span>⌘/Ctrl + Enter to send</span>
            <a href="/responder" className="responder-link">
              Open responder dashboard →
            </a>
          </div>

          {error && <div className="error">⚠ {error}</div>}

          {submitted.length > 0 && (
            <div className="sent-list">
              <div className="sent-head">Submitted this session</div>
              {submitted.map((r) => (
                <div className="sent-card" key={r.id}>
                  <span
                    className="badge"
                    style={{ background: colorForUrgency(r.urgency) }}
                  >
                    {r.urgency}
                  </span>
                  <div className="sent-body">
                    <div className="sent-title">{r.title}</div>
                    <div className="sent-meta">
                      {r.location}
                      {r.name !== "n/a" ? ` · ${r.name}` : ""}
                    </div>
                    <div className="sent-summary">{r.summary}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
