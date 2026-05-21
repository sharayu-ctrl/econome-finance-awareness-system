"""EconoMe — Learning Module Router"""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from shared.database import get_db
from shared.models import LearningContent, UserLearningProgress
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from modules.auth.router import get_current_user

router = APIRouter()


@router.get("/lessons")
async def list_lessons(
    difficulty: str | None = Query(default=None),
    topic: str | None = Query(default=None),
    page: int = 1,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    q = select(LearningContent).where(LearningContent.is_active == True)
    if difficulty:
        q = q.where(LearningContent.difficulty == difficulty)
    if topic:
        q = q.where(LearningContent.topic.ilike(f"%{topic}%"))
    q = q.offset((page - 1) * 20).limit(20)
    result = await db.execute(q)
    lessons = result.scalars().all()
    return [
        {
            "lesson_id": l.lesson_id,
            "topic": l.topic,
            "difficulty": l.difficulty,
            "tags": l.tags,
        }
        for l in lessons
    ]


@router.get("/lessons/{lesson_id}")
async def get_lesson(
    lesson_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LearningContent).where(LearningContent.lesson_id == lesson_id)
    )
    lesson = result.scalar_one_or_none()
    if not lesson:
        from shared.exceptions import FinanceEntryNotFoundError

        raise FinanceEntryNotFoundError("Lesson not found")
    return {
        "lesson_id": lesson.lesson_id,
        "topic": lesson.topic,
        "difficulty": lesson.difficulty,
        "content_md": lesson.content_md,
        "tags": lesson.tags,
    }


class CompleteRequest(BaseModel):
    score: float = 0.0


@router.post("/lessons/{lesson_id}/complete")
async def complete_lesson(
    lesson_id: str,
    req: CompleteRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user["sub"]
    result = await db.execute(
        select(UserLearningProgress).where(
            UserLearningProgress.user_id == user_id,
            UserLearningProgress.lesson_id == lesson_id,
        )
    )
    progress = result.scalar_one_or_none()
    if progress:
        progress.status = "completed"
        progress.score = req.score
        progress.completed_at = datetime.utcnow()
    else:
        db.add(
            UserLearningProgress(
                user_id=user_id,
                lesson_id=lesson_id,
                status="completed",
                score=req.score,
                completed_at=datetime.utcnow(),
            )
        )
    return {"message": "Lesson completed", "score": req.score}


@router.get("/progress")
async def my_progress(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(UserLearningProgress).where(
            UserLearningProgress.user_id == current_user["sub"]
        )
    )
    rows = result.scalars().all()
    completed = [r for r in rows if r.status == "completed"]
    return {
        "total_completed": len(completed),
        "lessons": [
            {
                "lesson_id": r.lesson_id,
                "status": r.status,
                "score": float(r.score or 0),
                "completed_at": str(r.completed_at),
            }
            for r in rows
        ],
    }


@router.get("/profile")
async def get_profile(
    current_user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    from shared.models import User
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.user_id == current_user["sub"]))
    user = result.scalar_one_or_none()
    if not user:
        raise UserNotFoundError()
    return {
        "user_id": user.user_id,
        "full_name": user.full_name,
        "email": user.email,
        "is_verified": user.is_verified,
        "mfa_enabled": user.mfa_secret_enc is not None,
        "created_at": str(user.created_at),
        "last_login_at": str(user.last_login_at),
    }


@router.put("/profile")
async def update_profile(
    data: dict,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from shared.models import User
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.user_id == current_user["sub"]))
    user = result.scalar_one_or_none()
    if data.get("full_name"):
        user.full_name = data["full_name"]
    return {"message": "Profile updated"}
