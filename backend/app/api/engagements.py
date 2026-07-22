import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.db.session import get_db
from app.db.models import Engagement, User
from app.core.scope_validator import validate_target_domain, ScopeValidationError
from app.auth.security import get_current_user
from app.queue.arq_settings import enqueue_recon_job

router = APIRouter(prefix="/engagements", tags=["engagements"])


class EngagementCreate(BaseModel):
    target_domain: str


class EngagementOut(BaseModel):
    id: uuid.UUID
    target_domain: str
    status: str

    class Config:
        from_attributes = True


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


@router.get("/{engagement_id}/report")
async def get_report(engagement_id: uuid.UUID):
    raise HTTPException(status_code=501, detail="Not implemented")


@router.post("/{engagement_id}/abort")
async def abort_engagement(engagement_id: uuid.UUID):
    raise HTTPException(status_code=501, detail="Not implemented")
