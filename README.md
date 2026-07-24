# AI Crisis Triage Mapper

Paste raw, unstructured crisis reports on the left, hit **Analyze Data**, and
watch AI-extracted events light up a 3D globe — color-coded and scaled by
urgency. Built with **FastAPI** (backend) and **React + Vite + react-globe.gl**
(frontend).

> **Hackathon note:** to save time and API cost, the `/api/triage` endpoint
> returns a hardcoded set of 5 diverse crisis events instead of calling a real
> LLM. Swapping in a real model call is a one-function change in
> [`backend/main.py`](backend/main.py).

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+** and npm

## Project layout

```
google_hackathon/
├── backend/         # FastAPI API
│   ├── main.py
│   └── requirements.txt
└── frontend/        # React + Vite app
    └── src/App.jsx
```

---

## 1. Run the backend (FastAPI)

Open a terminal:

```bash
cd backend

# (optional but recommended) create a virtual environment
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt

uvicorn main:app --reload --port 8000
```

The API is now live at **http://localhost:8000**.
Interactive docs: **http://localhost:8000/docs**

## 2. Run the frontend (React + Vite)

Open a **second** terminal:

```bash
cd frontend
npm install          # already run during setup, safe to run again
npm run dev
```

Vite prints a local URL (usually **http://localhost:5173**). Open it in your
browser.

---

## Using it

1. Make sure **both** servers are running.
2. In the app, paste (or use the pre-filled sample) crisis reports in the text
   area.
3. Click **Analyze Data**.
4. The globe populates with points:
   - **Neon red** = critical (urgency **> 7**)
   - **Neon yellow** = elevated (urgency **≤ 7**)
   - Point height and size scale with the urgency score.
   - The camera flies to the most urgent event. Hover a point for details.

## API reference

`POST /api/triage`

Request body:

```json
{ "raw_text": "Wildfire near Los Angeles, evacuations ordered..." }
```

Response: a JSON array of events, each with `lat`, `lng`, `urgency` (1–10) and
`description`.

## Going further

- Replace the hardcoded list in [`backend/main.py`](backend/main.py) with a real
  LLM call that parses `raw_text` into the same `CrisisEvent` shape.
- Adjust the urgency → color / size mapping in
  [`frontend/src/App.jsx`](frontend/src/App.jsx).
