"""app/routers/sessions.py — POST /api/v1/sessions."""
import uuid
import logging

from fastapi import APIRouter, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import db_session
from app.models.session import UserSession
from app.schemas.session import SessionResponse

router = APIRouter(prefix="/api/v1", tags=["sessions"])
logger = logging.getLogger(__name__)


@router.post("/sessions", response_model=SessionResponse, status_code=201)
async def create_session(request: Request):
    """
    Create a new anonymous session.
    Returns a session UUID that must be passed in all subsequent requests.
    """
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    async with db_session() as db:
        session = UserSession(
            id=uuid.uuid4(),
            ip_address=ip,
            user_agent=ua,
        )
        db.add(session)

    logger.info("Created session %s from %s", session.id, ip)
    return SessionResponse.model_validate(session)
