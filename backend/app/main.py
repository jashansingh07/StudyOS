from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Subject


app = FastAPI(
    title="StudyOS API",
    description="AI Academic Mentor & Multi-Source Learning Platform",
    version="0.1.0"
)


@app.get("/")
def root():
    return {
        "message": "StudyOS API is running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }


@app.post("/users")
def create_user(
    name: str,
    email: str,
    db: Session = Depends(get_db)
):
    user = User(
        name=name,
        email=email
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email
    }

@app.get("/users/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email
    }

@app.get("/users/{user_id}/subjects")
def get_user_subjects(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    subjects = db.query(Subject).filter(
        Subject.user_id == user_id
    ).all()

    return [
        {
            "id": subject.id,
            "name": subject.name,
            "user_id": subject.user_id
        }
        for subject in subjects
    ]

@app.post("/subjects")
def create_subject(
    name: str,
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
        status_code=404,
        detail="User not found"
    )

    subject = Subject(
        name=name,
        user_id=user_id
    )

    db.add(subject)
    db.commit()
    db.refresh(subject)

    return {
        "id": subject.id,
        "name": subject.name,
        "user_id": subject.user_id
    }