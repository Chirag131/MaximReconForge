import uuid
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.db.models import Engagement, User
from app.core.scope_validator import validate_target_domain, ScopeValidationError
from app.auth.security import get_current_user
from app.queue.arq_settings import enqueue_recon_job
from app.context_store.store import ContextStore

router = APIRouter(prefix="/engagements", tags=["engagements"])


class EngagementCreate(BaseModel):
    target_domain: str


class EngagementOut(BaseModel):
    id: uuid.UUID
    target_domain: str
    status: str

    class Config:
        from_attributes = True


class ReportOut(BaseModel):
    engagement_id: uuid.UUID
    target_domain: str
    status: str
    report_markdown: str


@router.post("", response_model=EngagementOut, status_code=201)
async def create_engagement(
    payload: EngagementCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        resolved_ips = validate_target_domain(payload.target_domain)
    except ScopeValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    engagement = Engagement(
        target_domain=payload.target_domain.strip().lower(),
        status="pending",
        scope_snapshot={"resolved_ips": resolved_ips},
        created_by=current_user.id,
    )
    db.add(engagement)
    await db.commit()
    await db.refresh(engagement)

    await enqueue_recon_job(str(engagement.id))

    return engagement


@router.get("/{engagement_id}/report", response_model=ReportOut)
async def get_report(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Engagement).where(Engagement.id == engagement_id)
    res = await db.execute(stmt)
    engagement = res.scalar_one_or_none()

    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    store = ContextStore()
    report_file = store.get_engagement_dir(str(engagement_id)) / "report" / "final_report.md"

    if not report_file.exists():
        raise HTTPException(
            status_code=404,
            detail="Report not generated yet. Engagement status is currently: " + engagement.status,
        )

    report_content = report_file.read_text(encoding="utf-8")
    return ReportOut(
        engagement_id=engagement.id,
        target_domain=engagement.target_domain,
        status=engagement.status,
        report_markdown=report_content,
    )


@router.post("/{engagement_id}/abort", response_model=EngagementOut)
async def abort_engagement(
    engagement_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Engagement).where(Engagement.id == engagement_id)
    res = await db.execute(stmt)
    engagement = res.scalar_one_or_none()

    if not engagement:
        raise HTTPException(status_code=404, detail="Engagement not found")

    engagement.status = "aborted"
    await db.commit()
    await db.refresh(engagement)

    return engagement
