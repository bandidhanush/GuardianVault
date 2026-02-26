"""
Twilio SMS alert service for accident notifications.
"""
import logging
from datetime import datetime
from config import settings

logger = logging.getLogger(__name__)


def send_accident_alert(incident_data: dict, to_number: str = None) -> dict:
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
        f"🚨 ACCIDENT: {incident_data.get('severity_label', 'Unknown')}\n"
        f"Loc: {incident_data.get('location_name', 'Unknown')}\n"
        f"Cam: {incident_data.get('camera_name', 'Unknown')}\n"
        f"ID: {incident_data.get('incident_id', 'N/A')[:8]}\n"
        f"Monitor: GuardianVault"
    )

    target_number = to_number or settings.ALERT_TO_NUMBER
    
    # E.164 Clean-up: Ensure number starts with + and has country code
    if target_number:
        target_number = target_number.strip().replace(" ", "")
        if not target_number.startswith('+'):
            if target_number.startswith('91') and len(target_number) > 10:
                target_number = "+" + target_number
            else:
                target_number = "+91" + target_number

    # Check if Twilio credentials are configured
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        logger.warning("[AlertService] Twilio credentials not configured. Simulating alert.")
        logger.info(f"[AlertService] SIMULATED SMS TO {target_number}:\n{message}")
        return {
            "success": True,
            "simulated": True,
            "message": message,
            "to": target_number,
            "sid": "SIMULATED_SID",
        }

    try:
        from twilio.rest import Client
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        sms = client.messages.create(
            body=message,
            from_=settings.TWILIO_FROM_NUMBER,
            to=target_number,
        )
        logger.info(f"[AlertService] SMS sent successfully to {target_number}. SID: {sms.sid}")
        return {
            "success": True,
            "simulated": False,
            "message": message,
            "to": target_number,
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
