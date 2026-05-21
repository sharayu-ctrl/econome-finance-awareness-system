"""EconoMe — Chat Router (AI Finance Tutor)"""

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from shared.database import AsyncSessionLocal, get_db
from sqlalchemy.ext.asyncio import AsyncSession

from modules.ai_insight.orchestrator import _get_summary
from modules.auth.router import get_current_user
from modules.chat.service import handle_chat_message
from modules.macro.service import get_macro_snapshot

router = APIRouter()


class ChatRequest(BaseModel):
    session_id: str | None = None
    message: str


@router.post("/message")
async def chat(
    req: ChatRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["sub"]
    session_id = req.session_id or str(uuid.uuid4())
    period = datetime.utcnow().strftime("%Y-%m")

    financial_ctx = await _get_summary(db, user_id, period)
    macro_ctx = await get_macro_snapshot(db)

    return await handle_chat_message(
        db=db,
        user_id=user_id,
        session_id=session_id,
        user_message=req.message,
        financial_context=financial_ctx,
        macro_context=macro_ctx,
    )


@router.websocket("/ws/{session_id}")
async def chat_websocket(websocket: WebSocket, session_id: str):
    """
    WebSocket endpoint for real-time streaming AI tutor responses.
    Token passed as query param: /chat/ws/{session_id}?token=<JWT>
    """
    await websocket.accept()
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001)
        return

    try:
        from modules.auth.service import decode_access_token

        payload = await decode_access_token(token)
        user_id = payload["sub"]
    except Exception:
        await websocket.close(code=4001)
        return

    try:
        async with AsyncSessionLocal() as db:
            period = datetime.utcnow().strftime("%Y-%m")
            financial_ctx = await _get_summary(db, user_id, period)
            macro_ctx = await get_macro_snapshot(db)

            while True:
                data = await websocket.receive_text()
                result = await handle_chat_message(
                    db=db,
                    user_id=user_id,
                    session_id=session_id,
                    user_message=data,
                    financial_context=financial_ctx,
                    macro_context=macro_ctx,
                )
                await websocket.send_json(result)
    except WebSocketDisconnect:
        pass


@router.post("/ai")
async def ai_chat(
    request: dict,
    current_user: dict = Depends(get_current_user),
):
    """
    Proxy endpoint for Anthropic API calls from frontend.
    Keeps API key server-side only.
    """
    import os

    import httpx

    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not anthropic_key:
        return {
            "content": [
                {
                    "text": "AI service not configured. Please add ANTHROPIC_API_KEY to backend/.env"
                }
            ]
        }

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": anthropic_key,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json=request,
        )
        return response.json()
