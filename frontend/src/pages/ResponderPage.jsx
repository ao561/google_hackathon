import { useRef, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import Globe from "react-globe.gl";

// Neon red for critical (urgency > 7), neon yellow otherwise.
const colorForUrgency = (u) => (u > 7 ? "#ff0044" : "#ffe600");

export default function ResponderPage({ events }) {
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

  // Fly the camera to the most urgent event whenever the data changes.
  useEffect(() => {
    if (!events.length || !globeRef.current) return;
    const top = [...events].sort((a, b) => b.urgency - a.urgency)[0];
    globeRef.current.pointOfView(
      { lat: top.lat, lng: top.lng, altitude: 2.2 },
      1200
    );
  }, [events]);

  return (
    <section className="responder-view">
      <aside className="feed">
        <Link className="back-link" to="/user">
          <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
          <span>Crisis assistant</span>
        </Link>
        <span className="eyebrow">Responder · Live feed</span>
        <div className="legend">
          <span>
            <i className="dot red" /> Critical (urgency &gt; 7)
          </span>
          <span>
            <i className="dot yellow" /> Elevated (urgency ≤ 7)
          </span>
        </div>

        {events.length === 0 ? (
          <p className="empty">
            No triaged events yet. Switch to the <b>User</b> tab and analyze
            some reports.
          </p>
        ) : (
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
      </div>
    </section>
  );
}
