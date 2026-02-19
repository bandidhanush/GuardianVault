"""
WebSocket connection manager for real-time dashboard updates.
"""
import json
import logging
from typing import List
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"[WebSocket] Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"[WebSocket] Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, message: dict):
        """Send a message to all connected clients."""
        data = json.dumps(message)
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(data)
            except Exception as e:
                logger.warning(f"[WebSocket] Failed to send to client: {e}")
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)

    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send a message to a specific client."""
        try:
            await websocket.send_text(json.dumps(message))
        except Exception as e:
            logger.warning(f"[WebSocket] Failed to send personal message: {e}")
            self.disconnect(websocket)

    async def broadcast_accident(self, incident_data: dict):
        """Broadcast accident detection event."""
        await self.broadcast({
            "type": "accident_detected",
            "data": incident_data,
        })

    async def broadcast_system_status(self, status: dict):
        """Broadcast system status update."""
        await self.broadcast({
            "type": "system_status",
            "data": status,
        })

    async def broadcast_alert_sent(self, alert_data: dict):
        """Broadcast alert sent confirmation."""
        await self.broadcast({
            "type": "alert_sent",
            "data": alert_data,
        })

    async def broadcast_detection_update(self, camera_id: str, confidence: float, is_accident: bool):
        """Broadcast live detection update (sent every second for live feeds)."""
        await self.broadcast({
            "type": "detection_update",
            "data": {
                "camera_id": camera_id,
                "confidence": confidence,
                "is_accident": is_accident,
            },
        })


# Global singleton
manager = ConnectionManager()
