# AI Crisis Triage Mapper

Two roles, two URLs, one live crisis picture:

- **`/user`** — a reporter describes a crisis in free text **or voice**. Gemini
  turns it into a structured record (name, age, urgency, location, summary,
  notes) and it's stored in SQLite.
- **`/responder`** — a live dashboard: a sortable, region-filterable event feed
  on the left and a heatmapped, interactive **3D globe** (`react-globe.gl`) on
  the right. Zoom into a country to outline it and filter the feed; click any
  event for a full AI summary with a Google Maps directions link.

Built with **FastAPI** (backend) + **React + Vite** (frontend).

> **No API key? Still works.** If `GEMINI_API_KEY` is not set, the backend runs
> in a deterministic **mock mode** that fabricates plausible structured reports,
> so the whole app demos end-to-end with zero setup or cost.

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm
- (Optional) a **Gemini API key** from https://aistudio.google.com/apikey for
  real AI extraction.
- **Voice input** uses the browser-native Web Speech API — works in **Chrome /
  Edge**. Elsewhere the mic is disabled and typing still works.

## Project layout

```
google_hackathon/
├── backend/                 # FastAPI API
│   ├── main.py              # Gemini triage (+ mock), SQLite store, REST
│   ├── requirements.txt
│   └── .env.example         # copy to .env and add your key
└── frontend/                # React + Vite app
    ├── public/countries.geojson   # bundled country borders (offline-safe)
    └── src/
        ├── pages/UserPage.jsx       # news feed + text/voice composer
        ├── pages/ResponderPage.jsx  # feed + globe + region filter
        ├── components/ReportOverlay.jsx
        ├── utils/geo.js             # point-in-polygon + time-elapsed
        └── api.js
```

---

## 1. Run the backend (FastAPI)

```bash
# from the repo root — create & activate a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r backend/requirements.txt

# (optional) enable real Gemini extraction:
cp backend/.env.example backend/.env
#   then edit backend/.env and set GEMINI_API_KEY=...

cd backend
uvicorn main:app --reload --port 8000
```

API at **http://localhost:8000** · interactive docs at **/docs**.
`GET /` reports whether it's running in `gemini` or `mock` mode.

## 2. Run the frontend (React + Vite)

Open a **second** terminal:

```bash
cd frontend
npm install          # already run during setup, safe to run again
npm run dev
```

Open the printed URL (usually **http://localhost:5173**). It redirects to
`/user`; the responder dashboard is at **/responder**.

---

## Using it

1. Make sure **both** servers are running.
2. On **`/user`**: read the mock newswire, then describe a crisis in the
   composer (type, or click **🎤 Voice** in Chrome/Edge) and hit **Send**.
3. On **`/responder`**: the event streams into the feed (polled every ~4s) and
   onto the globe.
   - **Sort** the feed by **Urgency** or **Recent**.
   - **Drag** to rotate the globe; **scroll to zoom** into a country — its
     border is outlined and the feed filters to events inside it.
   - The **heatmap** glows hotter/redder where reports cluster with high
     urgency. **Hover** a point for its urgency + summary.
   - **Click** an event (feed box or globe point) for the full AI summary:
     personal info, time since report, notes, and a **Directions** button that
     opens Google Maps navigation to the location.

Color coding: **neon red** = critical (urgency > 7), **neon yellow** = elevated.

## API reference

| Method | Endpoint        | Body                 | Returns                          |
| ------ | --------------- | -------------------- | -------------------------------- |
| `POST` | `/api/triage`   | `{ "raw_text": "…" }`| The stored structured report     |
| `GET`  | `/api/reports`  | —                    | All reports, newest first        |
| `GET`  | `/`             | —                    | Health + current mode            |

A report record: `id, created_at, name, age, urgency (1–10), title, summary,
notes, other_data, location, lat, lng`. Absent fields come back as `"n/a"`
(coordinates as `null`).

## Notes & customization

- Extraction lives in [`backend/main.py`](backend/main.py): `extract_with_gemini`
  (real) and `extract_mock` (key-free). The prompt/schema is `ExtractedReport`.
- Data persists in `backend/crisis.db` (gitignored). Delete the file to reset.
- Urgency → color mapping and globe layers are in
  [`frontend/src/pages/ResponderPage.jsx`](frontend/src/pages/ResponderPage.jsx).
