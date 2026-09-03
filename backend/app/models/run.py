"""
app/models/run.py — AnalysisRun ORM model.
One row per /analyze request, capturing the full pipeline result.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AnalysisRun(Base):
    __tablename__ = "runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    query: Mapped[str] = mapped_column(Text, nullable=False)
    image_count: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    task_type: Mapped[str | None] = mapped_column(String(40), nullable=True)
    specialist: Mapped[str | None] = mapped_column(String(60), nullable=True)
    model_used: Mapped[str | None] = mapped_column(String(40), nullable=True)
    confidence: Mapped[int | None] = mapped_column(Integer, nullable=True)
    answer_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # pending | running | done | error
    status: Mapped[str] = mapped_column(
        String(20), default="pending", nullable=False, index=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    duration_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # ── Relationships ──────────────────────────────────────────────────────────
    session: Mapped["UserSession"] = relationship(  # noqa: F821
        back_populates="runs",
        lazy="select",
    )
    trace_events: Mapped[list["TraceEvent"]] = relationship(  # noqa: F821
        back_populates="run",
        cascade="all, delete-orphan",
        order_by="TraceEvent.step_index",
        lazy="select",
    )

    def __repr__(self) -> str:
        return f"<AnalysisRun id={self.id} status={self.status} task={self.task_type}>"
