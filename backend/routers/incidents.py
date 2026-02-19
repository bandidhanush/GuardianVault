"""
Incidents router: history, filtering, status management.
"""
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from database.connection import get_db
from database.models import Incident
from database.schemas import IncidentResponse

router = APIRouter(prefix="/api/incidents", tags=["incidents"])
logger = logging.getLogger(__name__)


@router.get("/", response_model=List[IncidentResponse])
def list_incidents(
    severity: Optional[int] = Query(None),
    camera_id: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    db: Session = Depends(get_db),
):
    query = db.query(Incident).order_by(desc(Incident.timestamp))
    if severity:
        query = query.filter(Incident.severity_level == severity)
    if camera_id:
        query = query.filter(Incident.camera_id == camera_id)
    if status:
        query = query.filter(Incident.status == status)
    return query.offset(offset).limit(limit).all()


@router.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics."""
    from datetime import datetime, timedelta
    from sqlalchemy import func

    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = now - timedelta(days=7)
    month_start = now - timedelta(days=30)

    total = db.query(func.count(Incident.id)).scalar()
    today = db.query(func.count(Incident.id)).filter(Incident.timestamp >= today_start).scalar()
    this_week = db.query(func.count(Incident.id)).filter(Incident.timestamp >= week_start).scalar()
    this_month = db.query(func.count(Incident.id)).filter(Incident.timestamp >= month_start).scalar()

    severity_counts = {}
    for level in [1, 2, 3]:
        count = db.query(func.count(Incident.id)).filter(Incident.severity_level == level).scalar()
        severity_counts[level] = count

    return {
        "total": total,
        "today": today,
        "this_week": this_week,
        "this_month": this_month,
        "severity_distribution": severity_counts,
        "alert_sent_count": db.query(func.count(Incident.id)).filter(Incident.alert_sent == True).scalar(),
    }


@router.get("/{incident_id}", response_model=IncidentResponse)
def get_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    return incident


@router.patch("/{incident_id}/status")
def update_status(incident_id: str, status: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    if status not in ["detected", "reviewed", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status")
    incident.status = status
    db.commit()
    return {"id": incident_id, "status": status}


@router.delete("/{incident_id}")
def delete_incident(incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")
    db.delete(incident)
    db.commit()
    return {"message": "Incident deleted"}
