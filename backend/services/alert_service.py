"""
Twilio SMS alert service for accident notifications.
"""
import logging
from datetime import datetime
from config import settings

logger = logging.getLogger(__name__)


def send_accident_alert(incident_data: dict) -> dict:
    """
    Send SMS alert via Twilio when an accident is detected.
    incident_data keys: incident_id, timestamp, severity_label, severity_level,
                        location_name, location_lat, location_lon,
                        confidence, camera_name
    """
    timestamp = incident_data.get("timestamp", datetime.utcnow())
    if isinstance(timestamp, datetime):
        timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S UTC")
    else:
        timestamp_str = str(timestamp)

    severity_emoji = {"Minor Impact": "🟡", "Substantial Impact": "🟠", "Critical Impact": "🔴"}.get(
        incident_data.get("severity_label", ""), "🚨"
    )

    message = (
        f"🚨 ACCIDENT DETECTED\n"
        f"Time: {timestamp_str}\n"
        f"Severity: {severity_emoji} {incident_data.get('severity_label', 'Unknown')}\n"
        f"Location: {incident_data.get('location_name', 'Unknown')} "
        f"({incident_data.get('location_lat', 'N/A')}, {incident_data.get('location_lon', 'N/A')})\n"
        f"Confidence: {incident_data.get('confidence', 0) * 100:.1f}%\n"
        f"Camera: {incident_data.get('camera_name', 'Unknown')}\n"
        f"Evidence ID: {incident_data.get('incident_id', 'N/A')}\n"
        f"System: Road Safety Monitor v1.0"
    )

    # Check if Twilio credentials are configured
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.warning("[AlertService] Twilio credentials not configured. Simulating alert.")
        logger.info(f"[AlertService] SIMULATED SMS:\n{message}")
        return {
            "success": True,
            "simulated": True,
            "message": message,
            "to": settings.ALERT_TO_NUMBER,
            "sid": "SIMULATED_SID",
        }

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        sms = client.messages.create(
            body=message,
            from_=settings.TWILIO_FROM_NUMBER,
            to=settings.ALERT_TO_NUMBER,
        )
        logger.info(f"[AlertService] SMS sent successfully. SID: {sms.sid}")
        return {
            "success": True,
            "simulated": False,
            "message": message,
            "to": settings.ALERT_TO_NUMBER,
            "sid": sms.sid,
        }
    except Exception as e:
        logger.error(f"[AlertService] Failed to send SMS: {e}")
        return {
            "success": False,
            "simulated": False,
            "error": str(e),
            "message": message,
        }
