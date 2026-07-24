"""AI Crisis Triage Mapper - FastAPI backend.

For this hackathon template, the /api/triage endpoint bypasses a real LLM call
and returns a hardcoded set of diverse crisis events. Swap out `triage` with a
real model call when you're ready.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


class TriageRequest(BaseModel):
    raw_text: str


class CrisisEvent(BaseModel):
    lat: float
    lng: float
    urgency: int  # 1-10
    description: str


@app.get("/")
def health():
    return {"status": "ok", "service": "AI Crisis Triage Mapper"}


@app.post("/api/triage", response_model=list[CrisisEvent])
def triage(request: TriageRequest):
    """Return AI-extracted crisis events.

    In production this would send `request.raw_text` to an LLM and parse the
    structured response. For the template we return diverse dummy events so the
    globe has something impressive to render immediately.
    """
    return [
        {
            "lat": 34.0522,
            "lng": -118.2437,
            "urgency": 9,
            "description": "Wildfire spreading rapidly near Los Angeles; evacuations underway.",
        },
        {
            "lat": 24.8607,
            "lng": 67.0011,
            "urgency": 8,
            "description": "Severe monsoon flooding in Karachi; thousands displaced.",
        },
        {
            "lat": -1.2921,
            "lng": 36.8219,
            "urgency": 6,
            "description": "Drought-driven food shortage reported around Nairobi.",
        },
        {
            "lat": 35.6895,
            "lng": 139.6917,
            "urgency": 5,
            "description": "Moderate earthquake felt in Tokyo; infrastructure checks in progress.",
        },
        {
            "lat": 40.4168,
            "lng": -3.7038,
            "urgency": 3,
            "description": "Heatwave advisory issued for Madrid; cooling centers opened.",
        },
    ]
