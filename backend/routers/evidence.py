"""
Evidence router: hash verification, video streaming, PDF certificate generation.
"""
import os
import io
import logging
import tempfile
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import Incident, Evidence
from database.schemas import EvidenceResponse
from services.encryption_service import decrypt_video, verify_hash
from config import settings

router = APIRouter(prefix="/api/evidence", tags=["evidence"])
logger = logging.getLogger(__name__)


@router.get("/{incident_id}", response_model=EvidenceResponse)
def get_evidence(incident_id: str, db: Session = Depends(get_db)):
    evidence = db.query(Evidence).filter(Evidence.incident_id == incident_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="Evidence not found")
    return evidence


@router.get("/{incident_id}/verify")
def verify_evidence(incident_id: str, db: Session = Depends(get_db)):
    """Re-compute hash and verify tamper-evident storage."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if not incident.video_clip_path or not os.path.exists(incident.video_clip_path):
        raise HTTPException(status_code=404, detail="Encrypted video file not found")

    if not incident.video_hash_sha256:
        raise HTTPException(status_code=400, detail="No hash stored for this incident")

    result = verify_hash(incident.video_clip_path, incident.video_hash_sha256)
    return {
        "incident_id": incident_id,
        "verified": result["matches"],
        "computed_hash": result["computed_hash"],
        "stored_hash": result["expected_hash"],
        "matches": result["matches"],
        "status": "VERIFIED ✅" if result["matches"] else "TAMPERED ❌",
    }


@router.get("/{incident_id}/stream")
def stream_video(incident_id: str, db: Session = Depends(get_db)):
    """Decrypt video and stream it for playback."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    if not incident.video_clip_path or not os.path.exists(incident.video_clip_path):
        raise HTTPException(status_code=404, detail="Encrypted video file not found")

    # Decrypt to temp file
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp_path = tmp.name
    tmp.close()

    try:
        decrypt_video(incident.video_clip_path, tmp_path)

        def iterfile():
            try:
                with open(tmp_path, "rb") as f:
                    while chunk := f.read(65536):
                        yield chunk
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)

        return StreamingResponse(
            iterfile(),
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'inline; filename="evidence_{incident_id}.mp4"',
                "X-Evidence-ID": incident_id,
                "X-SHA256": incident.video_hash_sha256 or "",
            },
        )
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        logger.error(f"[Evidence] Stream error: {e}")
        raise HTTPException(status_code=500, detail=f"Decryption error: {str(e)}")


@router.get("/{incident_id}/thumbnail")
def get_thumbnail(incident_id: str, db: Session = Depends(get_db)):
    """Return incident thumbnail."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident or not incident.thumbnail_path:
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    if not os.path.exists(incident.thumbnail_path):
        raise HTTPException(status_code=404, detail="Thumbnail file not found")
    return FileResponse(incident.thumbnail_path, media_type="image/jpeg")


@router.get("/{incident_id}/certificate")
def download_certificate(incident_id: str, db: Session = Depends(get_db)):
    """Generate and download a PDF evidence certificate (Section 65B compliant)."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    evidence = db.query(Evidence).filter(Evidence.incident_id == incident_id).first()

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import cm
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_CENTER, TA_LEFT

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2*cm, bottomMargin=2*cm)

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle("Title", parent=styles["Title"],
                                     fontSize=18, textColor=colors.HexColor("#1a1a2e"),
                                     spaceAfter=6, alignment=TA_CENTER)
        subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"],
                                        fontSize=11, textColor=colors.HexColor("#16213e"),
                                        alignment=TA_CENTER, spaceAfter=4)
        header_style = ParagraphStyle("Header", parent=styles["Heading2"],
                                      fontSize=13, textColor=colors.HexColor("#0f3460"),
                                      spaceBefore=12, spaceAfter=6)
        body_style = ParagraphStyle("Body", parent=styles["Normal"],
                                    fontSize=10, leading=14)
        legal_style = ParagraphStyle("Legal", parent=styles["Normal"],
                                     fontSize=9, leading=13,
                                     textColor=colors.HexColor("#333333"),
                                     borderColor=colors.HexColor("#0f3460"),
                                     borderWidth=1, borderPadding=8,
                                     backColor=colors.HexColor("#f0f4ff"))

        story = []

        # Header
        story.append(Paragraph("🛡️ DIGITAL EVIDENCE CERTIFICATE", title_style))
        story.append(Paragraph("Road Accident Detection & Emergency Alert System", subtitle_style))
        story.append(Paragraph("Cryptographically Secured Video Evidence", subtitle_style))
        story.append(HRFlowable(width="100%", thickness=2, color=colors.HexColor("#0f3460")))
        story.append(Spacer(1, 0.4*cm))

        # Incident Details
        story.append(Paragraph("INCIDENT DETAILS", header_style))
        incident_data = [
            ["Incident ID", str(incident.id)],
            ["Timestamp", incident.timestamp.strftime("%Y-%m-%d %H:%M:%S UTC") if incident.timestamp else "N/A"],
            ["Camera", incident.camera.name if incident.camera else "Uploaded Video"],
            ["Location", incident.location_name or "Unknown"],
            ["GPS Coordinates", f"{incident.location_lat}, {incident.location_lon}" if incident.location_lat else "N/A"],
            ["Severity Level", f"Level {incident.severity_level} — {incident.severity_label}"],
            ["Detection Confidence", f"{incident.accident_confidence * 100:.2f}%"],
            ["Status", incident.status.upper()],
        ]
        t = Table(incident_data, colWidths=[5*cm, 12*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8eaf6")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
            ("PADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.4*cm))

        # Cryptographic Fingerprint
        story.append(Paragraph("CRYPTOGRAPHIC FINGERPRINT", header_style))
        crypto_data = [
            ["SHA-256 Hash", incident.video_hash_sha256 or "N/A"],
            ["MD5 Hash", incident.video_hash_md5 or "N/A"],
            ["Encryption Algorithm", evidence.encryption_algorithm if evidence else "AES-256-CBC"],
            ["Key Hash (Audit)", incident.encryption_key_hash or "N/A"],
            ["Evidence Created", evidence.created_at.strftime("%Y-%m-%d %H:%M:%S UTC") if evidence and evidence.created_at else "N/A"],
            ["File Size", f"{evidence.file_size_bytes:,} bytes" if evidence and evidence.file_size_bytes else "N/A"],
            ["Duration", f"{evidence.duration_seconds:.1f} seconds" if evidence and evidence.duration_seconds else "N/A"],
        ]
        t2 = Table(crypto_data, colWidths=[5*cm, 12*cm])
        t2.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#e8f5e9")),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cccccc")),
            ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f9f9f9")]),
            ("PADDING", (0, 0), (-1, -1), 6),
            ("WORDWRAP", (1, 0), (1, -1), True),
        ]))
        story.append(t2)
        story.append(Spacer(1, 0.5*cm))

        # Legal Statement
        story.append(Paragraph("LEGAL COMPLIANCE STATEMENT", header_style))
        legal_text = (
            "<b>Section 65B — Indian Evidence Act, 1872 Compliance</b><br/><br/>"
            "This video evidence has been cryptographically secured using AES-256-CBC encryption "
            "immediately upon detection. The SHA-256 hash displayed above serves as a tamper-evident "
            "digital seal of the original video content.<br/><br/>"
            "The hash was computed from the original, unmodified video file BEFORE encryption. "
            "Any tampering with the stored evidence will result in a hash mismatch, which can be "
            "verified using the 'Verify Integrity' function of this system.<br/><br/>"
            "This certificate is generated automatically by the Road Accident Detection & Emergency "
            "Alert System v1.0 and constitutes a computer-generated document as defined under "
            "Section 65B of the Indian Evidence Act, 1872."
        )
        story.append(Paragraph(legal_text, legal_style))
        story.append(Spacer(1, 0.5*cm))

        # Footer
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cccccc")))
        story.append(Spacer(1, 0.2*cm))
        story.append(Paragraph(
            f"Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')} | "
            f"System: Road Safety Monitor v1.0 | Certificate ID: CERT-{incident_id[:8].upper()}",
            ParagraphStyle("Footer", parent=styles["Normal"], fontSize=8,
                           textColor=colors.grey, alignment=TA_CENTER)
        ))

        doc.build(story)
        buffer.seek(0)

        return StreamingResponse(
            io.BytesIO(buffer.read()),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="evidence_certificate_{incident_id[:8]}.pdf"'
            },
        )

    except ImportError:
        raise HTTPException(status_code=500, detail="reportlab not installed. Run: pip install reportlab")
    except Exception as e:
        logger.error(f"[Evidence] Certificate error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Certificate generation error: {str(e)}")


@router.get("/{incident_id}/hash-report")
def download_hash_report(incident_id: str, db: Session = Depends(get_db)):
    """Download a plain-text hash report."""
    incident = db.query(Incident).filter(Incident.id == incident_id).first()
    if not incident:
        raise HTTPException(status_code=404, detail="Incident not found")

    report = (
        f"ROAD ACCIDENT DETECTION SYSTEM — HASH INTEGRITY REPORT\n"
        f"{'='*60}\n"
        f"Incident ID:     {incident.id}\n"
        f"Timestamp:       {incident.timestamp}\n"
        f"Location:        {incident.location_name}\n"
        f"Severity:        Level {incident.severity_level} — {incident.severity_label}\n"
        f"Confidence:      {incident.accident_confidence * 100:.2f}%\n"
        f"\n--- CRYPTOGRAPHIC HASHES (Original File) ---\n"
        f"SHA-256:         {incident.video_hash_sha256 or 'N/A'}\n"
        f"MD5:             {incident.video_hash_md5 or 'N/A'}\n"
        f"Encryption:      AES-256-CBC\n"
        f"Key Hash:        {incident.encryption_key_hash or 'N/A'}\n"
        f"\nGenerated: {datetime.utcnow().isoformat()} UTC\n"
        f"System: Road Safety Monitor v1.0\n"
    )

    return StreamingResponse(
        io.BytesIO(report.encode()),
        media_type="text/plain",
        headers={"Content-Disposition": f'attachment; filename="hash_report_{incident_id[:8]}.txt"'},
    )
