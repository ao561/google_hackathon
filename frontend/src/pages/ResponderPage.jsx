import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import Globe from "react-globe.gl";
import { getReports } from "../api.js";
import { findCountryAt, pointInFeature, countryName } from "../utils/geo.js";
import ReportOverlay from "../components/ReportOverlay.jsx";

const colorForUrgency = (u) => (u > 7 ? "#ff0044" : "#ffe600");
const POLL_MS = 4000;
const ZOOM_THRESHOLD = 1.6; // camera altitude below which we detect a country
const esc = (s) => String(s ?? "").replace(/</g, "&lt;");

export default function ResponderPage() {
  const [reports, setReports] = useState([]);
  const [features, setFeatures] = useState([]);
  const [activeCountry, setActiveCountry] = useState(null);
  const [sortBy, setSortBy] = useState("time"); // "time" | "urgency"
  const [selected, setSelected] = useState(null);

  const globeRef = useRef();
  const wrapRef = useRef();
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const activeNameRef = useRef(null);

  // Load country borders once (served locally from /public).
  useEffect(() => {
    fetch("/countries.geojson")
      .then((r) => r.json())
      .then((g) => setFeatures(g.features || []))
      .catch(() => setFeatures([]));
  }, []);

  // Poll the backend for reports.
  useEffect(() => {
    let alive = true;
    const load = () =>
      getReports()
        .then((data) => alive && setReports(data))
        .catch(() => {});
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

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

  // Reports that can actually be plotted.
  const mappable = useMemo(
    () => reports.filter((r) => r.lat != null && r.lng != null),
    [reports]
  );

  // Feed filtered to the active region, then sorted.
  const visible = useMemo(() => {
    const inRegion = activeCountry
      ? reports.filter(
          (r) =>
            r.lat != null &&
            r.lng != null &&
            pointInFeature(r.lat, r.lng, activeCountry)
        )
      : reports;
    const sorted = [...inRegion];
    if (sortBy === "urgency") sorted.sort((a, b) => b.urgency - a.urgency);
    else sorted.sort((a, b) => b.id - a.id); // newest first
    return sorted;
  }, [reports, activeCountry, sortBy]);

  // When the camera moves, detect which country it is centered over.
  const handleZoom = useCallback(
    (pov) => {
      if (!features.length) return;
      if (pov.altitude > ZOOM_THRESHOLD) {
        if (activeNameRef.current !== null) {
          activeNameRef.current = null;
          setActiveCountry(null);
        }
        return;
      }
      const found = findCountryAt(pov.lat, pov.lng, features);
      const name = found ? countryName(found) : null;
      if (name !== activeNameRef.current) {
        activeNameRef.current = name;
        setActiveCountry(found);
      }
    },
    [features]
  );

  const clearRegion = () => {
    activeNameRef.current = null;
    setActiveCountry(null);
  };

  return (
    <section className="responder-view">
      {/* LEFT: crisis event feed */}
      <aside className="feed">
        <div className="feed-head">
          <span className="section-eyebrow">Global crisis events</span>
          <div className="sort">
            <button
              className={sortBy === "urgency" ? "active" : ""}
              onClick={() => setSortBy("urgency")}
            >
              Urgency
            </button>
            <button
              className={sortBy === "time" ? "active" : ""}
              onClick={() => setSortBy("time")}
            >
              Recent
            </button>
          </div>
        </div>

        {activeCountry && (
          <div className="region-banner">
            <span>
              Showing <b>{countryName(activeCountry)}</b>
            </span>
            <button onClick={clearRegion} aria-label="Clear region filter">
              ✕
            </button>
          </div>
        )}

        <div className="legend">
          <span>
            <i className="dot red" /> Critical (urgency &gt; 7)
          </span>
          <span>
            <i className="dot yellow" /> Elevated (urgency ≤ 7)
          </span>
        </div>

        {visible.length === 0 ? (
          <p className="empty">
            {activeCountry
              ? "No events in this region yet."
              : "No crisis events yet. Submit reports from the User page."}
          </p>
        ) : (
          <div className="event-list">
            {visible.map((r) => (
              <button
                className="event-box"
                key={r.id}
                onClick={() => setSelected(r)}
              >
                <span
                  className="badge"
                  style={{ background: colorForUrgency(r.urgency) }}
                >
                  {r.urgency}
                </span>
                <div className="event-body">
                  <div className="event-title">{r.title}</div>
                  <div className="event-loc">📍 {r.location}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </aside>

      {/* RIGHT: interactive globe */}
      <div className="globe-wrap" ref={wrapRef}>
        <Globe
          ref={globeRef}
          width={dims.width}
          height={dims.height}
          backgroundColor="#05070d"
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          atmosphereColor="#3a7bd5"
          atmosphereAltitude={0.22}
          onZoom={handleZoom}
          /* Heatmap: darker/hotter where reports cluster and urgency is high */
          heatmapsData={[mappable]}
          heatmapPointLat="lat"
          heatmapPointLng="lng"
          heatmapPointWeight={(d) => d.urgency / 2}
          heatmapBandwidth={0.9}
          heatmapColorSaturation={2.2}
          heatmapTopAltitude={0.28}
          heatmapsTransitionDuration={600}
          /* Points: hover + click targets */
          pointsData={mappable}
          pointLat="lat"
          pointLng="lng"
          pointColor={(d) => colorForUrgency(d.urgency)}
          pointAltitude={(d) => 0.02 + (d.urgency / 10) * 0.25}
          pointRadius={0.22}
          pointLabel={(d) =>
            `<div class="tip"><b>Urgency ${d.urgency}/10 · ${esc(
              d.location
            )}</b><br/>${esc(d.summary)}</div>`
          }
          onPointClick={(d) => setSelected(d)}
          pointsMerge={false}
          /* Region outline: only the active country */
          polygonsData={activeCountry ? [activeCountry] : []}
          polygonCapColor={() => "rgba(255, 0, 68, 0.12)"}
          polygonSideColor={() => "rgba(255, 0, 68, 0.05)"}
          polygonStrokeColor={() => "#ff5a7a"}
          polygonAltitude={0.012}
        />

        <div className="globe-hint">
          Drag to rotate · scroll to zoom into a region
        </div>
      </div>

      {selected && (
        <ReportOverlay report={selected} onClose={() => setSelected(null)} />
      )}
    </section>
  );
}
