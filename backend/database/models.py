import uuid
from datetime import datetime
from sqlalchemy import Column, String, Float, Boolean, Integer, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database.connection import Base


def generate_uuid():
    return str(uuid.uuid4())


class Camera(Base):
    __tablename__ = "cameras"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    location_name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    rtsp_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True)

    # Nearby emergency services
    nearby_police_lat = Column(Float, nullable=True)
    nearby_police_lon = Column(Float, nullable=True)
    police_name = Column(String(255), nullable=True)
    police_phone = Column(String(50), nullable=True)

    nearby_hospital_lat = Column(Float, nullable=True)
    nearby_hospital_lon = Column(Float, nullable=True)
    hospital_name = Column(String(255), nullable=True)
    hospital_phone = Column(String(50), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    incidents = relationship("Incident", back_populates="camera")


class Incident(Base):
    __tablename__ = "incidents"

    id = Column(String, primary_key=True, default=generate_uuid)
    camera_id = Column(String, ForeignKey("cameras.id"), nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    # Detection results
    accident_confidence = Column(Float, nullable=False)
    severity_level = Column(Integer, nullable=False)  # 1, 2, 3
    severity_label = Column(String(50), nullable=False)  # Minor, Substantial, Critical

    # Location
    location_lat = Column(Float, nullable=True)
    location_lon = Column(Float, nullable=True)
    location_name = Column(String(255), nullable=True)

    # Alert
    alert_sent = Column(Boolean, default=False)
    alert_sent_at = Column(DateTime, nullable=True)
    alert_message = Column(Text, nullable=True)

    # Video evidence
    video_clip_path = Column(String(500), nullable=True)
    thumbnail_path = Column(String(500), nullable=True)
    video_hash_sha256 = Column(String(64), nullable=True)
    video_hash_md5 = Column(String(32), nullable=True)
    encryption_key_hash = Column(String(64), nullable=True)  # hash of key, NOT the key itself

    # Status
    status = Column(String(50), default="detected")  # detected / reviewed / closed

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    camera = relationship("Camera", back_populates="incidents")
    evidence = relationship("Evidence", back_populates="incident", uselist=False)


class Evidence(Base):
    __tablename__ = "evidence"

    id = Column(String, primary_key=True, default=generate_uuid)
    incident_id = Column(String, ForeignKey("incidents.id"), nullable=False)

    original_filename = Column(String(255), nullable=True)
    encrypted_filename = Column(String(255), nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    duration_seconds = Column(Float, nullable=True)

    sha256_hash = Column(String(64), nullable=True)
    md5_hash = Column(String(32), nullable=True)
    encryption_algorithm = Column(String(50), default="AES-256-CBC")

    created_at = Column(DateTime, default=datetime.utcnow)
    reviewed_by = Column(String(255), nullable=True)
    review_notes = Column(Text, nullable=True)
    is_court_submitted = Column(Boolean, default=False)

    incident = relationship("Incident", back_populates="evidence")
