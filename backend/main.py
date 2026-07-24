"""AI Crisis Triage Mapper - FastAPI backend.

Reporters submit free-form crisis reports (text or transcribed voice). This
service asks Gemini to turn each report into a structured JSON record, stores it
in a local SQLite database, and serves the records to the responder dashboard.

If GEMINI_API_KEY is not set, a deterministic mock extractor is used instead so
the app is fully runnable without a key.
"""

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
DB_PATH = Path(__file__).parent / "crisis.db"

app = FastAPI(title="AI Crisis Triage Mapper")

# Allow the Vite dev server (and other localhost ports) to call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Models
# --------------------------------------------------------------------------- #
class TriageRequest(BaseModel):
    raw_text: str


class Report(BaseModel):
    id: int
    created_at: str
    name: str
    age: str
    urgency: int
    title: str
    summary: str
    notes: str
    other_data: str
    location: str
    lat: float | None = None
    lng: float | None = None


# The structured shape we ask Gemini to extract (no id/created_at — those are
# assigned server-side).
class ExtractedReport(BaseModel):
    name: str
    age: str
    urgency: int
    title: str
    summary: str
    notes: str
    other_data: str
    location: str
    lat: float | None = None
    lng: float | None = None


# --------------------------------------------------------------------------- #
# Database
# --------------------------------------------------------------------------- #
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db():
    with get_db() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT    NOT NULL,
                name       TEXT    NOT NULL,
                age        TEXT    NOT NULL,
                urgency    INTEGER NOT NULL,
                title      TEXT    NOT NULL,
                summary    TEXT    NOT NULL,
                notes      TEXT    NOT NULL,
                other_data TEXT    NOT NULL,
                location   TEXT    NOT NULL,
                lat        REAL,
                lng        REAL
            )
            """
        )


init_db()


def insert_report(data: ExtractedReport) -> Report:
    created_at = datetime.now(timezone.utc).isoformat()
    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO reports
                (created_at, name, age, urgency, title, summary, notes,
                 other_data, location, lat, lng)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                created_at,
                data.name,
                data.age,
                _clamp_urgency(data.urgency),
                data.title,
                data.summary,
                data.notes,
                data.other_data,
                data.location,
                data.lat,
                data.lng,
            ),
        )
        new_id = cur.lastrowid
    return Report(id=new_id, created_at=created_at, **_extracted_dict(data))


def list_reports() -> list[Report]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM reports ORDER BY id DESC"
        ).fetchall()
    return [Report(**dict(row)) for row in rows]


def delete_report(report_id: int) -> bool:
    with get_db() as conn:
        cur = conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
    return cur.rowcount > 0


def _extracted_dict(data: ExtractedReport) -> dict:
    d = data.model_dump()
    d["urgency"] = _clamp_urgency(d["urgency"])
    return d


def _clamp_urgency(value: int) -> int:
    try:
        return max(1, min(10, int(value)))
    except (TypeError, ValueError):
        return 1


# --------------------------------------------------------------------------- #
# Extraction: Gemini (if key present) or deterministic mock
# --------------------------------------------------------------------------- #
EXTRACTION_INSTRUCTIONS = """
You are a crisis-triage assistant. Extract a single structured crisis report
from the message below. Rules:
- Fill EVERY field. If a field is not mentioned or cannot be inferred, use the
  literal string "n/a" (for lat/lng, use null instead).
- `urgency` is an integer 1-10 that YOU assess from severity and risk to life
  (10 = imminent loss of life / mass-casualty; 1 = minor / informational).
- `title` is a short (<= 8 words) headline of the incident.
- `summary` is a concise 1-2 sentence AI summary of the situation.
- `notes` captures additional details specific to the issue (injuries, hazards,
  numbers affected), or "n/a".
- `other_data` captures any other extracted personal/contextual details worth
  showing a responder (e.g. medical conditions, contact info), or "n/a".
- `location` is the most specific place name available, or "n/a".
- `lat` and `lng` are approximate decimal coordinates for that location, or null
  if unknown.

Message:
"""


def extract_with_gemini(raw_text: str) -> ExtractedReport:
    # Imported lazily so the app still boots without the package installed.
    from google import genai
    from google.genai import types

    client = genai.Client(api_key=GEMINI_API_KEY)
    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=EXTRACTION_INSTRUCTIONS + raw_text,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=ExtractedReport,
            temperature=0.2,
        ),
    )
    parsed = response.parsed
    if isinstance(parsed, ExtractedReport):
        return parsed
    # Fallback: parse the raw JSON text ourselves.
    return ExtractedReport(**json.loads(response.text))


# A handful of sample coordinates so mock-mode reports still spread across the
# globe and light up the heatmap.
_MOCK_CITIES = [
    ("Los Angeles, USA", 34.0522, -118.2437),
    ("Karachi, Pakistan", 24.8607, 67.0011),
    ("Nairobi, Kenya", -1.2921, 36.8219),
    ("Tokyo, Japan", 35.6895, 139.6917),
    ("Madrid, Spain", 40.4168, -3.7038),
    ("São Paulo, Brazil", -23.5505, -46.6333),
    ("Jakarta, Indonesia", -6.2088, 106.8456),
    ("Istanbul, Turkey", 41.0082, 28.9784),
]

_HIGH_URGENCY_WORDS = (
    "trapped", "fire", "flood", "collapse", "gas leak", "explosion",
    "shooting", "earthquake", "drowning", "bleeding", "unconscious", "dying",
)
_MED_URGENCY_WORDS = ("injured", "evacuate", "storm", "outage", "shortage")


def extract_mock(raw_text: str) -> ExtractedReport:
    """Deterministic, key-free extractor for demos without a Gemini key."""
    text = raw_text.strip()
    lower = text.lower()

    if any(w in lower for w in _HIGH_URGENCY_WORDS):
        urgency = 9
    elif any(w in lower for w in _MED_URGENCY_WORDS):
        urgency = 6
    else:
        urgency = 3

    first_line = text.splitlines()[0] if text else "Unspecified report"
    title = (first_line[:60] + "…") if len(first_line) > 60 else first_line

    # Rotate through sample cities based on the current row count so points
    # spread out instead of stacking.
    with get_db() as conn:
        count = conn.execute("SELECT COUNT(*) FROM reports").fetchone()[0]
    location, lat, lng = _MOCK_CITIES[count % len(_MOCK_CITIES)]

    return ExtractedReport(
        name="n/a",
        age="n/a",
        urgency=urgency,
        title=title or "Unspecified report",
        summary=(text[:200] + "…") if len(text) > 200 else (text or "n/a"),
        notes="n/a",
        other_data="Generated in mock mode (no GEMINI_API_KEY set).",
        location=location,
        lat=lat,
        lng=lng,
    )


def extract(raw_text: str) -> ExtractedReport:
    if GEMINI_API_KEY:
        try:
            return extract_with_gemini(raw_text)
        except Exception as exc:  # noqa: BLE001 - never let extraction crash the API
            print(f"[triage] Gemini extraction failed, using mock: {exc}")
    return extract_mock(raw_text)


# --------------------------------------------------------------------------- #
# Routes
# --------------------------------------------------------------------------- #
@app.get("/")
def health():
    return {
        "status": "ok",
        "service": "AI Crisis Triage Mapper",
        "mode": "gemini" if GEMINI_API_KEY else "mock",
    }


@app.post("/api/triage", response_model=Report)
def triage(request: TriageRequest):
    if not request.raw_text.strip():
        raise HTTPException(status_code=400, detail="raw_text must not be empty")
    extracted = extract(request.raw_text)
    return insert_report(extracted)


@app.get("/api/reports", response_model=list[Report])
def get_reports():
    return list_reports()


@app.delete("/api/reports/{report_id}")
def resolve_report(report_id: int):
    if not delete_report(report_id):
        raise HTTPException(status_code=404, detail="Report not found")
    return {"status": "resolved", "id": report_id}
