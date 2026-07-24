# AI Crisis Triage Mapper

Two roles, three routes, and one live crisis picture:

- **`/user`** — a reporter describes a crisis in free text or by voice. Gemini
  turns it into a structured record and stores it in SQLite.
- **`/responder`** — a live, sortable event feed beside an interactive 3D
  globe. Zoom into a country to filter the feed; select an event for its full
  AI summary and a Google Maps directions link.
- **`/news`** — a calm, responsive local crisis briefing.

The reporter and news views use the Neural Expressive visual system, while the
responder view keeps the operational data dense and scannable.

Built with **FastAPI** and **React + Vite**.

> **No API key? It still works.** Without `GEMINI_API_KEY`, the backend uses a
> deterministic mock extractor so the complete flow can be demonstrated with
> no external setup or cost.

## Prerequisites

- Python 3.10+
- Node.js 18+ and npm
- Optionally, a
  [Gemini API key](https://aistudio.google.com/apikey) for live extraction
- Chrome or Edge for browser-native voice input; typing works everywhere

## Project layout

```text
google_hackathon/
├── backend/
│   ├── main.py                    # Gemini triage, mock mode, SQLite, REST
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── public/countries.geojson   # bundled country borders
    └── src/
        ├── pages/UserPage.jsx
        ├── pages/NewsPage.jsx
        ├── pages/ResponderPage.jsx
        ├── components/ReportOverlay.jsx
        ├── utils/geo.js
        └── api.js
```

## Run the backend

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Optional: enable Gemini instead of deterministic mock mode.
cp backend/.env.example backend/.env
# Edit backend/.env and set GEMINI_API_KEY.

cd backend
uvicorn main:app --reload --port 8000
```

The API runs at `http://localhost:8000`; interactive documentation is available
at `/docs`. `GET /` reports whether extraction is in `gemini` or `mock` mode.

## Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the printed URL, normally `http://localhost:5173`. The app redirects to
`/user`.

To use another backend origin:

```bash
cp frontend/.env.example frontend/.env
```

Then set `VITE_API_BASE_URL` in `frontend/.env`.

## End-to-end flow

1. Submit a typed or spoken report from `/user`.
2. `POST /api/triage` extracts and stores a structured report.
3. `/responder` polls `GET /api/reports` approximately every four seconds.
4. Sort by urgency or recency, zoom to filter by country, and select any event
   to inspect its summary, personal details, location, and directions.

Critical events use neon red for urgency above 7; elevated events use neon
yellow.

## API reference

| Method | Endpoint | Body | Returns |
| --- | --- | --- | --- |
| `POST` | `/api/triage` | `{ "raw_text": "…" }` | Stored structured report |
| `GET` | `/api/reports` | — | All reports, newest first |
| `GET` | `/` | — | Health and current extraction mode |

A report contains `id`, `created_at`, `name`, `age`, `urgency`, `title`,
`summary`, `notes`, `other_data`, `location`, `lat`, and `lng`. Missing text
fields return as `"n/a"` and missing coordinates as `null`.

## Notes

- Gemini and mock extraction live in `backend/main.py`.
- Data persists in `backend/crisis.db`, which is gitignored.
- Globe layers, filtering, polling, and urgency colors live in
  `frontend/src/pages/ResponderPage.jsx`.
