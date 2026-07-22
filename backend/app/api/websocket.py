import uuid
from fastapi import APIRouter, WebSocket

router = APIRouter()


@router.websocket("/ws/engagements/{engagement_id}/live")
async def engagement_live(websocket: WebSocket, engagement_id: uuid.UUID):
    """PLACEHOLDER — live engagement stream. Aggregator/whiteboard push comes in a later pass."""
    await websocket.accept()
    await websocket.close(code=1013, reason="Not implemented")
