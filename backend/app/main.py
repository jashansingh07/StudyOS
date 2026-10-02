from fastapi import FastAPI

from app.database import Base, engine
from app import models


Base.metadata.create_all(bind=engine)


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