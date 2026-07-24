export default function UserPage({
  rawText,
  setRawText,
  analyze,
  loading,
  error,
  submitted,
  eventCount,
}) {
  return (
    <section className="user-view">
      <div className="card">
        <span className="eyebrow">User · Reporter</span>
        <h2>Submit raw crisis reports</h2>
        <p className="hint">
          Paste unstructured reports below. Our AI extracts each event's
          location and urgency, then hands them to responders.
        </p>

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

        {submitted && !error && (
          <div className="success">
            ✓ {eventCount} events triaged and sent to responders. Visit{" "}
            <code>/responder</code> to view the map.
          </div>
        )}
      </div>
    </section>
  );
}
