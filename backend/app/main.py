from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from .config import settings

app = FastAPI(
    title="EVNet Sentinel API",
    description="Backend API for Electric Vehicle Charging Station (EVCS) Intrusion Detection System",
    version="1.0.0"
)

# CORS (SEC-3: restrict to known local origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/status", tags=["System"])
async def get_status():
    return {"status": "ok", "version": app.version, "service": "EVNet Sentinel Backend"}

@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "healthy"}

@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            # Placeholder for alert stream
            data = await websocket.receive_text()
            await websocket.send_text(f"Message text was: {data}")
    except Exception as e:
        print(f"WebSocket Error: {e}")

