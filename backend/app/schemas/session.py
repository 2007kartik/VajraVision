"""app/schemas/session.py — Session request/response schemas."""
import uuid
from datetime import datetime

from pydantic import BaseModel


class SessionCreate(BaseModel):
    metadata: dict = {}


class SessionResponse(BaseModel):
    id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
