import { useEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faArrowUp,
  faMicrophone,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { triageReport } from "../api.js";
import CrisisRail from "../components/CrisisRail.jsx";
import { GlowEffect } from "../components/GlowEffect.jsx";
import SiriWave from "../components/SiriWave.jsx";
import { LONDON_NEWS } from "../data/news.js";
import "./UserPage.css";

export default function UserPage() {
  const [report, setReport] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submittedReport, setSubmittedReport] = useState(null);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const voiceWaveRef = useRef(null);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  const closeVoice = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const toggleVoice = () => {
    if (voiceOpen) {
      closeVoice();
      return;
    }

    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!Recognition) {
      inputRef.current?.focus();
      return;
    }

    setVoiceOpen(true);
    requestAnimationFrame(() => voiceWaveRef.current?.focus());

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-GB";
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");
      setReport(transcript);
    };
    recognition.onerror = () => {
      recognitionRef.current = null;
      setVoiceOpen(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setVoiceOpen(false);
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setVoiceOpen(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    const trimmedReport = report.trim();
    if (!trimmedReport || loading) return;

    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceOpen(false);
    setLoading(true);
    setError(null);
    setSubmittedReport(null);

    try {
      const createdReport = await triageReport(trimmedReport);
      setSubmittedReport(createdReport);
      setReport("");
    } catch (submissionError) {
      setError(
        submissionError.message || "Failed to reach the crisis service.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="neural-view">
      <CrisisRail
        active="incidents"
        disabled={loading}
        onAssistant={() =>
          voiceOpen ? toggleVoice() : inputRef.current?.focus()
        }
      />

      <div className="location-indicator">London, UK</div>

      <main className="neural-stage">
        <h1 className="neural-title">
          {voiceOpen
            ? "I’m listening, Danyil."
            : loading
              ? "I’m assessing the situation."
              : "What’s happening, Danyil?"}
        </h1>

        <div className="morph-zone" data-voice={voiceOpen}>
          <div className="input-glow" data-visible={!voiceOpen}>
            <GlowEffect
              colors={["#0894ff", "#c959dd", "#ff2e54", "#ff9004"]}
              mode="rotate"
              blur="medium"
              scale={1.04}
              duration={6}
            />
          </div>

          <form
            className={`prompt-pill${loading ? " is-loading" : ""}`}
            onSubmit={submitReport}
            aria-hidden={voiceOpen}
          >
            <input
              ref={inputRef}
              type="text"
              value={report}
              onChange={(event) => setReport(event.target.value)}
              placeholder="Describe the crisis…"
              aria-label="Crisis report"
              disabled={loading || voiceOpen}
              autoComplete="off"
              tabIndex={voiceOpen ? -1 : 0}
            />

            <button
              className="voice-button"
              type="button"
              onClick={toggleVoice}
              disabled={loading || voiceOpen}
              aria-label="Start voice input"
              tabIndex={voiceOpen ? -1 : 0}
            >
              <FontAwesomeIcon icon={faMicrophone} aria-hidden="true" />
            </button>

            {report.trim() && (
              <button
                className="send-button"
                type="submit"
                disabled={loading || voiceOpen}
                aria-label="Send crisis report"
                tabIndex={voiceOpen ? -1 : 0}
              >
                {loading ? (
                  <span className="send-loader" />
                ) : (
                  <FontAwesomeIcon icon={faArrowUp} aria-hidden="true" />
                )}
              </button>
            )}
          </form>

          <button
            ref={voiceWaveRef}
            className="listening-wave"
            type="button"
            onClick={toggleVoice}
            aria-label="Stop voice input"
            aria-hidden={!voiceOpen}
            tabIndex={voiceOpen ? 0 : -1}
          >
            <span className="wave-content">
              {voiceOpen && (
                <SiriWave
                  width={700}
                  height={190}
                  renderScale={0.68}
                  active
                  className="voice-siri-wave"
                />
              )}
              <span className="wave-status">
                <span className="listening-dot" aria-hidden="true" />
                <span>Touch to stop</span>
              </span>
            </span>
          </button>
        </div>

        <div className="neural-feedback" aria-live="polite">
          {error && (
            <div className="feedback-message is-error">
              I couldn’t send that report. {error}
            </div>
          )}
          {submittedReport && !error && (
            <div className="feedback-message is-success">
              <span>{submittedReport.title} is ready for responders.</span>
              <Link to="/responder">View responder map</Link>
            </div>
          )}
        </div>

        <section className="news-preview" aria-labelledby="news-preview-title">
          <header className="news-preview-header">
            <h2 id="news-preview-title">News</h2>
            <p>What’s happening in London, UK</p>
          </header>

          <div className="news-preview-grid">
            {LONDON_NEWS.slice(0, 3).map((item) => (
              <article className="news-preview-card" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </article>
            ))}
          </div>

          <Link className="news-more-link" to="/news">
            <span>Show more</span>
            <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
          </Link>
        </section>
      </main>
    </section>
  );
}
