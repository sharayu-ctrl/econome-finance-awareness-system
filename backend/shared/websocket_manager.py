"""
EconoMe WebSocket Manager (Phase 3a - Backend)
Handles real-time updates for: finance, insights, chat, dashboard refresh
"""
from datetime import datetime
from typing import Dict, List, Set, Optional
from loguru import logger
import socketio

from config import settings

# Create Socket.io manager with async mode
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=settings.ALLOWED_ORIGINS,
    ping_timeout=60,
    ping_interval=25,
)

# Track connected users: {user_id: {session_id, connected_at, last_action}}
connected_users: Dict[str, Dict] = {}
user_rooms: Dict[str, Set[str]] = {}  # user_id -> set of room ids


class WebSocketManager:
    """Manage WebSocket connections and events"""

    @staticmethod
    async def on_connect(sid: str, environ: dict, auth: Optional[dict] = None):
        """Handle new WebSocket connection"""
        try:
            if not auth or "token" not in auth:
                logger.warning(f"❌ Connection attempt without token: {sid}")
                return False

            token = auth["token"]
            # In production, validate JWT token here
            # For now, we'll assume it's validated by auth middleware

            logger.info(f"🔗 WebSocket client connected: {sid}")
            connected_users[sid] = {
                "connected_at": datetime.utcnow().isoformat(),
                "last_action": datetime.utcnow().isoformat(),
            }
            return True
        except Exception as e:
            logger.error(f"Connection error: {e}")
            return False

    @staticmethod
    async def on_disconnect(sid: str):
        """Handle WebSocket disconnection"""
        if sid in connected_users:
            del connected_users[sid]
        logger.info(f"🔌 WebSocket client disconnected: {sid}")

    @staticmethod
    async def on_finance_update(sid: str, data: dict):
        """
        Broadcast finance update to all connected clients
        Update types: transaction, budget, goal
        """
        try:
            user_id = data.get("user_id")
            update_type = data.get("type", "transaction")

            logger.info(f"📊 Finance update from {user_id}: {update_type}")

            # Broadcast to all clients of that user
            await sio.emit(
                "finance-update",
                {
                    "type": update_type,
                    "user_id": user_id,
                    "data": data.get("data", {}),
                    "timestamp": datetime.utcnow().isoformat(),
                },
                room=user_id,  # Emit only to user's rooms
            )
        except Exception as e:
            logger.error(f"Finance update error: {e}")

    @staticmethod
    async def on_insight_update(sid: str, data: dict):
        """
        Broadcast AI insight/recommendation update
        """
        try:
            user_id = data.get("user_id")
            insight_type = data.get("type", "insight")

            logger.info(f"💡 Insight update from {user_id}: {insight_type}")

            await sio.emit(
                "insight-update",
                {
                    "type": insight_type,
                    "user_id": user_id,
                    "content": data.get("content", ""),
                    "timestamp": datetime.utcnow().isoformat(),
                },
                room=user_id,
            )
        except Exception as e:
            logger.error(f"Insight update error: {e}")

    @staticmethod
    async def on_chat_message(sid: str, data: dict):
        """
        Handle chat message from AI tutor
        """
        try:
            room_id = data.get("room_id", "general")
            user_id = data.get("user_id")
            message = data.get("message", "")

            logger.info(f"💬 Chat message in {room_id} from {user_id}")

            # Broadcast to all users in that chat room
            await sio.emit(
                "chat-message",
                {
                    "room_id": room_id,
                    "user_id": user_id,
                    "message": message,
                    "timestamp": datetime.utcnow().isoformat(),
                },
                room=room_id,
            )
        except Exception as e:
            logger.error(f"Chat message error: {e}")

    @staticmethod
    async def on_request_dashboard_refresh(sid: str, data: dict):
        """
        Request dashboard refresh for a specific user
        Triggered when data changes in one tab/window
        """
        try:
            user_id = data.get("user_id")
            logger.info(f"🔄 Dashboard refresh requested for {user_id}")

            # Emit to all connections of that user
            await sio.emit(
                "dashboard-refresh",
                {
                    "timestamp": datetime.utcnow().isoformat(),
                },
                room=user_id,
            )
        except Exception as e:
            logger.error(f"Dashboard refresh error: {e}")

    @staticmethod
    async def on_join_room(sid: str, data: dict):
        """
        Join a specific room (e.g., chat room, user dashboard)
        """
        try:
            room_id = data.get("room_id")
            user_id = data.get("user_id")

            sio.enter_room(sid, room_id)
            if user_id not in user_rooms:
                user_rooms[user_id] = set()
            user_rooms[user_id].add(room_id)

            logger.info(f"👤 User {user_id} joined room {room_id}")

            # Notify others in the room
            await sio.emit(
                "user-joined",
                {"user_id": user_id, "room_id": room_id},
                room=room_id,
                skip_sid=sid,
            )
        except Exception as e:
            logger.error(f"Join room error: {e}")

    @staticmethod
    async def on_leave_room(sid: str, data: dict):
        """Leave a specific room"""
        try:
            room_id = data.get("room_id")
            user_id = data.get("user_id")

            sio.leave_room(sid, room_id)
            if user_id in user_rooms:
                user_rooms[user_id].discard(room_id)

            logger.info(f"👤 User {user_id} left room {room_id}")
        except Exception as e:
            logger.error(f"Leave room error: {e}")


# Register event handlers
def register_websocket_handlers():
    """Register all WebSocket event handlers"""
    sio.on("connect", handler=WebSocketManager.on_connect)
    sio.on("disconnect", handler=WebSocketManager.on_disconnect)
    sio.on("finance-update", handler=WebSocketManager.on_finance_update)
    sio.on("insight-update", handler=WebSocketManager.on_insight_update)
    sio.on("chat-message", handler=WebSocketManager.on_chat_message)
    sio.on("request-dashboard-refresh", handler=WebSocketManager.on_request_dashboard_refresh)
    sio.on("join-room", handler=WebSocketManager.on_join_room)
    sio.on("leave-room", handler=WebSocketManager.on_leave_room)


# Public API for backend services to emit events
async def emit_finance_update(user_id: str, update_type: str, data: dict):
    """Emit finance update to all clients of a user"""
    await sio.emit(
        "finance-update",
        {
            "type": update_type,
            "user_id": user_id,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        },
        room=user_id,
    )


async def emit_insight_update(user_id: str, insight_type: str, content: str):
    """Emit insight update to all clients of a user"""
    await sio.emit(
        "insight-update",
        {
            "type": insight_type,
            "user_id": user_id,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
        },
        room=user_id,
    )


async def emit_dashboard_refresh(user_id: str):
    """Request dashboard refresh for a user"""
    await sio.emit(
        "dashboard-refresh",
        {"timestamp": datetime.utcnow().isoformat()},
        room=user_id,
    )


async def emit_to_room(room_id: str, event: str, data: dict):
    """Emit event to all clients in a room"""
    await sio.emit(event, data, room=room_id)


def get_connected_users() -> Dict[str, Dict]:
    """Get list of connected users for monitoring"""
    return connected_users.copy()


def get_user_rooms(user_id: str) -> Set[str]:
    """Get rooms a user is connected to"""
    return user_rooms.get(user_id, set()).copy()
