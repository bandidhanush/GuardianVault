"""
FastAPI main application entry point.
"""
import logging
from datetime import datetime
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

from config import settings
from database.connection import init_db
from routers import detection, cameras, incidents, evidence
from services.websocket_manager import manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="AI-powered road accident detection with encrypted evidence storage and emergency alerts.",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS — allow React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(detection.router)
app.include_router(cameras.router)
app.include_router(incidents.router)
app.include_router(evidence.router)

# Serve thumbnails as static files
thumbnails_dir = os.path.join(settings.STORAGE_PATH, "thumbnails")
os.makedirs(thumbnails_dir, exist_ok=True)
app.mount("/thumbnails", StaticFiles(directory=thumbnails_dir), name="thumbnails")


# ── WebSocket endpoint for dashboard ──────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # Send initial system status
        await manager.send_personal_message({
            "type": "system_status",
            "data": {
                "status": "online",
                "timestamp": datetime.utcnow().isoformat(),
                "version": settings.VERSION,
            }
        }, websocket)
        while True:
            # Keep connection alive — client can send pings
            data = await websocket.receive_text()
            if data == "ping":
                await manager.send_personal_message({"type": "pong"}, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting Road Accident Detection System...")
    init_db()
    logger.info("✅ Database initialized")
    _seed_demo_cameras()
    logger.info("✅ Demo cameras seeded")
    # Pre-load ML models
    try:
        from backend.ml.accident_classifier import accident_classifier
        from backend.ml.severity_classifier import severity_classifier
        logger.info("✅ ML models initialized")
    except Exception as e:
        logger.warning(f"⚠️  ML model loading warning: {e}")


def _seed_demo_cameras():
    """Seed demo cameras if none exist."""
    from database.connection import SessionLocal
    from database.models import Camera

    db = SessionLocal()
    try:
        if db.query(Camera).count() == 0:
            cameras = [
                Camera(
                    name="Main Gate Camera",
                    location_name="College Main Entrance",
                    latitude=13.0827,
                    longitude=80.2707,
                    rtsp_url=None,
                    is_active=True,
                    police_name="Adyar Police Station",
                    nearby_police_lat=13.0012,
                    nearby_police_lon=80.2565,
                    police_phone="044-24910100",
                    hospital_name="Apollo Hospital",
                    nearby_hospital_lat=13.0569,
                    nearby_hospital_lon=80.2425,
                    hospital_phone="044-28296000",
                ),
                Camera(
                    name="Highway Junction Camera",
                    location_name="NH-44 Junction Point",
                    latitude=13.0674,
                    longitude=80.2376,
                    rtsp_url=None,
                    is_active=True,
                    police_name="Guindy Police Station",
                    nearby_police_lat=13.0067,
                    nearby_police_lon=80.2206,
                    police_phone="044-22350100",
                    hospital_name="MIOT International",
                    nearby_hospital_lat=13.0067,
                    nearby_hospital_lon=80.1856,
                    hospital_phone="044-22490900",
                ),
            ]
            for cam in cameras:
                db.add(cam)
            db.commit()
            logger.info("✅ Seeded 2 demo cameras")
    finally:
        db.close()


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "version": settings.VERSION,
        "app": settings.APP_NAME,
    }


@app.get("/")
def root():
    return {
        "message": "Road Accident Detection API",
        "docs": "/api/docs",
        "version": settings.VERSION,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
