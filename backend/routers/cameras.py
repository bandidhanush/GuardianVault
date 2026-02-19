"""
Camera management router.
"""
import logging
import cv2
import time
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Camera
from database.schemas import CameraCreate, CameraUpdate, CameraResponse

router = APIRouter(prefix="/api/cameras", tags=["cameras"])
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[CameraResponse])
def list_cameras(db: Session = Depends(get_db)):
    return db.query(Camera).order_by(Camera.created_at.desc()).all()


@router.get("/{camera_id}", response_model=CameraResponse)
def get_camera(camera_id: str, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    return camera


@router.post("/", response_model=CameraResponse)
def create_camera(camera_data: CameraCreate, db: Session = Depends(get_db)):
    camera = Camera(**camera_data.model_dump())
    db.add(camera)
    db.commit()
    db.refresh(camera)
    logger.info(f"[Cameras] Created camera: {camera.name}")
    return camera


@router.put("/{camera_id}", response_model=CameraResponse)
def update_camera(camera_id: str, camera_data: CameraUpdate, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    for key, value in camera_data.model_dump(exclude_unset=True).items():
        setattr(camera, key, value)
    db.commit()
    db.refresh(camera)
    return camera


@router.delete("/{camera_id}")
def delete_camera(camera_id: str, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    db.delete(camera)
    db.commit()
    return {"message": "Camera deleted successfully"}


@router.patch("/{camera_id}/toggle")
def toggle_camera(camera_id: str, db: Session = Depends(get_db)):
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    camera.is_active = not camera.is_active
    db.commit()
    return {"id": camera.id, "is_active": camera.is_active}
@router.get("/{camera_id}/stream")
def stream_camera(camera_id: str, db: Session = Depends(get_db)):
    """Stream MJPEG from RTSP URL."""
    camera = db.query(Camera).filter(Camera.id == camera_id).first()
    if not camera:
        raise HTTPException(status_code=404, detail="Camera not found")
    
    if not camera.rtsp_url:
        # Fallback if no RTSP URL: you might want to return a placeholder or 400
        raise HTTPException(status_code=400, detail="Camera does not have an RTSP URL")

    def generate_frames():
        cap = cv2.VideoCapture(camera.rtsp_url)
        # Reduce buffer size for lower latency
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        try:
            while True:
                success, frame = cap.read()
                if not success:
                    logger.warning(f"Failed to read from RTSP: {camera.rtsp_url}")
                    # Reconnect logic or break
                    cap.release()
                    cap = cv2.VideoCapture(camera.rtsp_url)
                    time.sleep(1)
                    continue

                # Encode as JPEG
                ret, buffer = cv2.imencode('.jpg', frame)
                if not ret:
                    continue
                
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        finally:
            cap.release()

    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")
