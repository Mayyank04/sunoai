from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from backend.app.core.database import get_db
from backend.app.core.security import get_current_user
from backend.app.models.user import User
from backend.app.models.daw_project import DawProject
from backend.app.schemas.other import DawProjectCreateRequest, DawProjectResponse

router = APIRouter(prefix="/daw", tags=["Multitrack DAW Projects"])

@router.get("/projects", response_model=List[DawProjectResponse])
async def list_user_daw_projects(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(DawProject).where(DawProject.user_id == current_user.id).order_by(desc(DawProject.updated_at))
    )
    projects = result.scalars().all()
    return [DawProjectResponse.model_validate(p) for p in projects]

@router.post("/projects", response_model=DawProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_or_save_daw_project(
    req: DawProjectCreateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    project = DawProject(
        user_id=current_user.id,
        title=req.title,
        bpm=req.bpm,
        time_signature=req.time_signature,
        master_volume=req.master_volume,
        project_state=req.project_state
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return DawProjectResponse.model_validate(project)

@router.get("/projects/{project_id}", response_model=DawProjectResponse)
async def get_daw_project(
    project_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(DawProject).where(DawProject.id == project_id))
    proj = result.scalar_one_or_none()
    if not proj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")

    if proj.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    return DawProjectResponse.model_validate(proj)
