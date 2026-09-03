"""
app/models/trace.py — TraceEvent ORM model.
One row per LangGraph node transition — the full agent audit trail.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TraceEvent(Base):
    __tablename__ = "trace_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_index: Mapped[int] = mapped_column(Integer, nullable=False)
    node_name: Mapped[str] = mapped_column(String(60), nullable=False)

    # node_start | node_end | tool_call | routing | error
    event_type: Mapped[str] = mapped_column(String(30), nullable=False)

    payload: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # ── Relationship ───────────────────────────────────────────────────────────
    run: Mapped["AnalysisRun"] = relationship(  # noqa: F821
        back_populates="trace_events",
        lazy="select",
    )

    def __repr__(self) -> str:
        return (
            f"<TraceEvent step={self.step_index} "
            f"node={self.node_name} type={self.event_type}>"
        )
