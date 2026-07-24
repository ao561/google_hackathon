import { useState, useRef, useEffect, useCallback } from "react";
import Globe from "react-globe.gl";
import "./App.css";

const API_URL = "http://localhost:8000/api/triage";

const SAMPLE_TEXT = `Wildfire spreading fast north of Los Angeles, evacuations ordered.
Heavy monsoon flooding across Karachi, thousands displaced.
Drought worsening around Nairobi, food shortages reported.
Moderate earthquake felt in Tokyo overnight.
Heatwave advisory issued for Madrid, cooling centers open.`;

// Neon red for critical (urgency > 7), neon yellow otherwise.
const colorForUrgency = (u) => (u > 7 ? "#ff0044" : "#ffe600");

export default function App() {
  const [rawText, setRawText] = useState(SAMPLE_TEXT);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const globeRef = useRef();
  const wrapRef = useRef();
  const [dims, setDims] = useState({ width: 800, height: 600 });

  // Keep the globe sized to its container.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () =>
      setDims({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Gentle auto-rotation for a bit of flair.
  useEffect(() => {
    if (globeRef.current) {
      const controls = globeRef.current.controls();
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.6;
    }
  }, [dims]);

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

      // Fly the camera to the most urgent event.
      if (data.length && globeRef.current) {
        const top = [...data].sort((a, b) => b.urgency - a.urgency)[0];
        globeRef.current.pointOfView(
          { lat: top.lat, lng: top.lng, altitude: 2.2 },
          1200
        );
      }
    } catch (e) {
      setError(e.message || "Failed to reach the backend.");
    } finally {
      setLoading(false);
    }
  }, [rawText]);

  return (
    <div className="app">
      <aside className="panel">
        <div className="brand">
          <span className="pulse" />
          <div>
            <h1>AI Crisis Triage Mapper</h1>
            <p className="tagline">
              Extract &amp; prioritize crisis events, visualized on a live globe.
            </p>
          </div>
        </div>

        <label className="label" htmlFor="reports">
          Raw crisis reports
        </label>
        <textarea
          id="reports"
          className="textarea"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste raw crisis reports here…"
          spellCheck={false}
        />

        <button className="analyze" onClick={analyze} disabled={loading}>
          {loading ? "Analyzing…" : "Analyze Data"}
        </button>

        {error && <div className="error">⚠ {error}</div>}

        <div className="legend">
          <span>
            <i className="dot red" /> Critical (urgency &gt; 7)
          </span>
          <span>
            <i className="dot yellow" /> Elevated (urgency ≤ 7)
          </span>
        </div>

        {events.length > 0 && (
          <div className="results">
            <div className="results-head">{events.length} events triaged</div>
            <ul>
              {[...events]
                .sort((a, b) => b.urgency - a.urgency)
                .map((ev, i) => (
                  <li key={i}>
                    <span
                      className="badge"
                      style={{ background: colorForUrgency(ev.urgency) }}
                    >
                      {ev.urgency}
                    </span>
                    <span className="desc">{ev.description}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}
      </aside>

      <main className="globe-wrap" ref={wrapRef}>
        <Globe
          ref={globeRef}
          width={dims.width}
          height={dims.height}
          backgroundColor="#05070d"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#3a7bd5"
          atmosphereAltitude={0.22}
          pointsData={events}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d) => colorForUrgency(d.urgency)}
          pointAltitude={(d) => 0.04 + (d.urgency / 10) * 0.5}
          pointRadius={(d) => 0.25 + (d.urgency / 10) * 0.55}
          pointLabel={(d) =>
            `<div class="tip"><b>Urgency ${d.urgency}/10</b><br/>${d.description}</div>`
          }
          pointsMerge={false}
        />
      </main>
    </div>
  );
}
