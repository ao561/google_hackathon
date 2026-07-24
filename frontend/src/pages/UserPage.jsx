import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faArrowUp,
  faMicrophone,
} from "@fortawesome/free-solid-svg-icons";
import { Link } from "react-router-dom";
import { getCrisisSupport, triageReport } from "../api.js";
import CrisisRail from "../components/CrisisRail.jsx";
import { GlowEffect } from "../components/GlowEffect.jsx";
import SiriWave from "../components/SiriWave.jsx";
import { LONDON_NEWS } from "../data/news.js";
import "./UserPage.css";

export default function UserPage() {
  const [report, setReport] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submittedReport, setSubmittedReport] = useState(null);
  const [messages, setMessages] = useState([]);
  const [handoffState, setHandoffState] = useState("idle");
  const [agentThinking, setAgentThinking] = useState(false);
  const [sceneActive, setSceneActive] = useState(false);
  const recognitionRef = useRef(null);
  const inputRef = useRef(null);
  const voiceWaveRef = useRef(null);
  const morphZoneRef = useRef(null);
  const conversationRef = useRef(null);
  const sceneActiveRef = useRef(false);
  const morphStartRectRef = useRef(null);
  const conversationStartedRef = useRef(false);
  const initialReportRef = useRef("");
  const messageIdRef = useRef(0);
  const submissionRef = useRef(0);

  useEffect(
    () => () => {
      recognitionRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    const conversation = conversationRef.current;
    if (!conversation || !sceneActive) return;

    const behavior = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? "auto"
      : "smooth";
    conversation.scrollTo({
      top: conversation.scrollHeight,
      behavior,
    });
  }, [agentThinking, handoffState, messages, sceneActive]);

  useLayoutEffect(() => {
    const morphZone = morphZoneRef.current;
    const startRect = morphStartRectRef.current;
    morphStartRectRef.current = null;

    if (!sceneActive || !morphZone || !startRect) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const endRect = morphZone.getBoundingClientRect();
    const translateX =
      startRect.left +
      startRect.width / 2 -
      (endRect.left + endRect.width / 2);
    const translateY =
      startRect.top +
      startRect.height / 2 -
      (endRect.top + endRect.height / 2);

    morphZone.getAnimations().forEach((animation) => animation.cancel());
    morphZone.animate(
      [
        { transform: `translate3d(${translateX}px, ${translateY}px, 0)` },
        { transform: "translate3d(0, 0, 0)" },
      ],
      {
        duration: 240,
        easing: "cubic-bezier(0.77, 0, 0.175, 1)",
      },
    );
  }, [sceneActive]);

  const activateScene = () => {
    if (sceneActiveRef.current) return;
    sceneActiveRef.current = true;
    morphStartRectRef.current = morphZoneRef.current?.getBoundingClientRect();
    setSceneActive(true);
  };

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
      if (transcript.trim()) activateScene();
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

  const nextMessageId = () => {
    messageIdRef.current += 1;
    return messageIdRef.current;
  };

  const submitReport = async (event) => {
    event.preventDefault();
    const trimmedReport = report.trim();
    if (!trimmedReport || loading) return;

    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setVoiceOpen(false);
    setLoading(true);
    setAgentThinking(true);
    activateScene();
    const submissionId = ++submissionRef.current;
    const history = messages.map(({ role, content }) => ({ role, content }));
    const userMessage = {
      id: nextMessageId(),
      role: "user",
      content: trimmedReport,
    };

    setMessages((current) => [...current, userMessage]);
    setReport("");

    if (!conversationStartedRef.current) {
      conversationStartedRef.current = true;
      initialReportRef.current = trimmedReport;
      setSubmittedReport(null);
      setHandoffState("sending");

      const [triageResult, supportResult] = await Promise.allSettled([
        triageReport(trimmedReport),
        getCrisisSupport(trimmedReport),
      ]);

      if (submissionRef.current !== submissionId) return;

      if (triageResult.status === "fulfilled") {
        setSubmittedReport(triageResult.value);
        setHandoffState("sent");
      } else {
        setHandoffState("failed");
      }

      const support =
        supportResult.status === "fulfilled"
          ? supportResult.value
          : {
              message:
                "I’m here with you. Stay somewhere safe and keep your phone nearby.",
              immediate_actions: [],
            };

      setMessages((current) => [
        ...current,
        {
          id: nextMessageId(),
          role: "assistant",
          content: support.message,
          actions: support.immediate_actions,
        },
      ]);
      setAgentThinking(false);
      setLoading(false);
      return;
    }

    try {
      const support = await getCrisisSupport(trimmedReport, history);
      if (submissionRef.current !== submissionId) return;
      setMessages((current) => [
        ...current,
        {
          id: nextMessageId(),
          role: "assistant",
          content: support.message,
          actions: support.immediate_actions,
        },
      ]);
    } catch {
      if (submissionRef.current === submissionId) {
        setMessages((current) => [
          ...current,
          {
            id: nextMessageId(),
            role: "assistant",
            content:
              "I’m still here. Stay somewhere safe and try your message again.",
            actions: [],
          },
        ]);
      }
    } finally {
      if (submissionRef.current === submissionId) {
        setAgentThinking(false);
        setLoading(false);
      }
    }
  };

  const retryHandoff = async () => {
    if (!initialReportRef.current || handoffState === "sending") return;
    setHandoffState("sending");
    try {
      const createdReport = await triageReport(initialReportRef.current);
      setSubmittedReport(createdReport);
      setHandoffState("sent");
    } catch {
      setHandoffState("failed");
    }
  };

  return (
    <section className="neural-view" data-engaged={sceneActive}>
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

        {sceneActive && (
          <section
            ref={conversationRef}
            className="conversation-thread"
            aria-label="Conversation with crisis support"
            aria-live="polite"
          >
            {messages.map((message, index) => (
              <div className="conversation-turn" key={message.id}>
                <article className={`chat-bubble is-${message.role}`}>
                  <p>{message.content}</p>
                  {message.actions?.length > 0 && (
                    <ul>
                      {message.actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  )}
                </article>

                {index === 0 && handoffState !== "idle" && (
                  <div className="handoff-event" data-state={handoffState}>
                    <span className="handoff-mark" aria-hidden="true" />
                    <div>
                      <span className="handoff-label">Responder handoff</span>
                      <p>
                        {handoffState === "sending"
                          ? "Sending your information to responders…"
                          : handoffState === "sent"
                            ? "Your information has been sent to the responders."
                            : "Your information could not be sent yet."}
                      </p>
                      {handoffState === "sent" && submittedReport && (
                        <Link to="/responder">View responder map</Link>
                      )}
                      {handoffState === "failed" && (
                        <button type="button" onClick={retryHandoff}>
                          Try again
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {agentThinking && (
              <div
                className="chat-bubble is-assistant is-thinking"
                aria-label="Support agent is responding"
              >
                <span />
                <span />
                <span />
              </div>
            )}
          </section>
        )}

        <div
          ref={morphZoneRef}
          className="morph-zone"
          data-voice={voiceOpen}
        >
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
              placeholder={
                messages.length > 0
                  ? "Message the support agent…"
                  : "Describe the crisis…"
              }
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
                aria-label={
                  messages.length > 0
                    ? "Send message"
                    : "Send crisis report"
                }
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
