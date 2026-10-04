from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, JSON

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=True)


class Subject(Base):
    __tablename__ = "subjects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)


class Document(Base):
    __tablename__ = "documents"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    filename = Column(String, nullable=False)
    type = Column(String, nullable=False)
    storage_ref = Column(String, nullable=False)
    status = Column(String, nullable=False)
    document_metadata = Column("metadata", JSON, nullable=True)
    created_at = Column(DateTime, nullable=False)


class DocumentChunk(Base):
    __tablename__ = "document_chunks"

    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id"), nullable=False)

    text = Column(String, nullable=False)
    page = Column(Integer, nullable=True)
    topic = Column(String, nullable=True)
    embedding_ref = Column(String, nullable=True)


class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    mastery = Column(Integer, nullable=True)

class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    source_document_id = Column(
        Integer,
        ForeignKey("documents.id"),
        nullable=True
    )

    text = Column(String, nullable=False)
    year = Column(Integer, nullable=True)
    topic = Column(String, nullable=True)

class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=True)

    score = Column(Integer, nullable=False)
    mistakes = Column(JSON, nullable=True)
    timestamp = Column(DateTime, nullable=False)

class StudyPlan(Base):
    __tablename__ = "study_plans"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subject_id = Column(Integer, ForeignKey("subjects.id"), nullable=False)

    deadline = Column(DateTime, nullable=True)
    daily_time = Column(Integer, nullable=True)
    plan_data = Column(JSON, nullable=True)
    status = Column(String, nullable=False)

class ProgressEvent(Base):
    __tablename__ = "progress_events"

    id = Column(Integer, primary_key=True, index=True)

    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    topic_id = Column(Integer, ForeignKey("topics.id"), nullable=False)

    event_type = Column(String, nullable=False)
    value = Column(Integer, nullable=True)
    timestamp = Column(DateTime, nullable=False)