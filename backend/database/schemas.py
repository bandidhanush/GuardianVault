from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ─── Camera Schemas ───────────────────────────────────────────────────────────

class CameraBase(BaseModel):
    name: str
    location_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    rtsp_url: Optional[str] = None
    is_active: bool = True
    nearby_police_lat: Optional[float] = None
    nearby_police_lon: Optional[float] = None
    police_name: Optional[str] = None
    police_phone: Optional[str] = None
    nearby_hospital_lat: Optional[float] = None
    nearby_hospital_lon: Optional[float] = None
    hospital_name: Optional[str] = None
    hospital_phone: Optional[str] = None


class CameraCreate(CameraBase):
    pass


class CameraUpdate(CameraBase):
    pass


class CameraResponse(CameraBase):
    id: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Incident Schemas ─────────────────────────────────────────────────────────

class IncidentBase(BaseModel):
    camera_id: Optional[str] = None
    accident_confidence: float
    severity_level: int
    severity_label: str
    location_lat: Optional[float] = None
    location_lon: Optional[float] = None
    location_name: Optional[str] = None


class IncidentCreate(IncidentBase):
    pass


class IncidentResponse(IncidentBase):
    id: str
    timestamp: datetime
    alert_sent: bool
    alert_sent_at: Optional[datetime] = None
    video_clip_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    video_hash_sha256: Optional[str] = None
    video_hash_md5: Optional[str] = None
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


# ─── Evidence Schemas ─────────────────────────────────────────────────────────

class EvidenceResponse(BaseModel):
    id: str
    incident_id: str
    original_filename: Optional[str] = None
    encrypted_filename: Optional[str] = None
    file_size_bytes: Optional[int] = None
    duration_seconds: Optional[float] = None
    sha256_hash: Optional[str] = None
    md5_hash: Optional[str] = None
    encryption_algorithm: str
    created_at: datetime
    reviewed_by: Optional[str] = None
    review_notes: Optional[str] = None
    is_court_submitted: bool

    class Config:
        from_attributes = True


# ─── Detection Schemas ────────────────────────────────────────────────────────

class DetectionResult(BaseModel):
    incident_id: Optional[str] = None
    accident_found: bool
    confidence: float
    severity_level: Optional[int] = None
    severity_label: Optional[str] = None
    video_hash_sha256: Optional[str] = None
    video_hash_md5: Optional[str] = None
    alert_sent: bool = False
    message: str = ""


class LiveFrameResult(BaseModel):
    accident_detected: bool
    confidence: float
    severity_level: Optional[int] = None
    severity_label: Optional[str] = None
