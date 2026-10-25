import os
import uuid
from pathlib import Path
from datetime import datetime, timezone
from pydantic import BaseModel
from google import genai
from google.genai import types
from semantic_search import search_chunks

from dotenv import load_dotenv
from pypdf import PdfReader

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import (
    OAuth2PasswordRequestForm,
    OAuth2PasswordBearer,
)

from sqlalchemy.orm import Session

from app.database import Base, engine, get_db
from app import models
from app.models import (
    User,
    Subject,
    Document,
    DocumentChunk,
    Topic,
    Question,
    QuizAttempt,
    StudyPlan,
    ProgressEvent,
)

from app.chunking import split_text

from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token,
)


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

load_dotenv()

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

# Store uploaded PDFs inside the backend directory.
BASE_DIR = Path(__file__).resolve().parent.parent
UPLOAD_DIR = BASE_DIR / "uploads"

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login")


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="StudyOS API",
    description="AI Academic Mentor & Multi-Source Learning Platform",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------
# DATABASE INITIALIZATION
# --------------------------------------------------

# Importing all models above registers them with Base.
# This creates missing tables in the configured SQLite database.
Base.metadata.create_all(bind=engine)


# --------------------------------------------------
# ROOT AND HEALTH CHECK
# --------------------------------------------------

@app.get("/")
def root():
    return {
        "message": "StudyOS API is running",
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
    }


# --------------------------------------------------
# CREATE USER
# --------------------------------------------------

@app.post("/users")
def create_user(
    name: str,
    email: str,
    password: str,
    db: Session = Depends(get_db),
):
    existing_user = db.query(User).filter(
        User.email == email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered",
        )

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password),
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
    }


# --------------------------------------------------
# GET USER
# --------------------------------------------------

@app.get("/users/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
    }


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    if not verify_password(
        form_data.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )

    access_token = create_access_token(user.id)

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
    }


# --------------------------------------------------
# AUTHENTICATED USER DEPENDENCY
# --------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    user_id = verify_access_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user


# --------------------------------------------------
# GET CURRENT USER
# --------------------------------------------------

@app.get("/me")
def me(
    current_user: User = Depends(get_current_user),
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
    }


# --------------------------------------------------
# GET USER SUBJECTS
# --------------------------------------------------

@app.get("/users/{user_id}/subjects")
def get_user_subjects(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to access this user's subjects",
        )

    subjects = db.query(Subject).filter(
        Subject.user_id == current_user.id
    ).all()

    return [
        {
            "id": subject.id,
            "name": subject.name,
            "user_id": subject.user_id,
        }
        for subject in subjects
    ]


# --------------------------------------------------
# CREATE SUBJECT
# --------------------------------------------------

@app.post("/subjects")
def create_subject(
    name: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    subject = Subject(
        name=name,
        user_id=current_user.id,
    )

    db.add(subject)
    db.commit()
    db.refresh(subject)

    return {
        "id": subject.id,
        "name": subject.name,
        "user_id": subject.user_id,
    }


# --------------------------------------------------
# UPLOAD AND PROCESS PDF
# --------------------------------------------------

@app.post("/subjects/{subject_id}/documents")
async def upload_document(
    subject_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    file_path = None

    try:
        # 1. Verify subject ownership.
        subject = db.query(Subject).filter(
            Subject.id == subject_id,
            Subject.user_id == current_user.id,
        ).first()

        if not subject:
            raise HTTPException(
                status_code=404,
                detail="Subject not found",
            )

        # 2. Validate filename and extension.
        if (
            not file.filename
            or not file.filename.lower().endswith(".pdf")
        ):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are supported",
            )

        # 3. Create the upload directory.
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

        # 4. Generate a unique storage filename.
        original_filename = os.path.basename(file.filename)
        unique_filename = f"{uuid.uuid4()}.pdf"
        file_path = UPLOAD_DIR / unique_filename

        # 5. Read the file with a 10 MB limit.
        content = await file.read(MAX_FILE_SIZE + 1)

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="File too large. Maximum allowed size is 10 MB.",
            )

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty",
            )

        # 6. Save the uploaded file.
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        # 7. Open and validate the PDF.
        reader = PdfReader(str(file_path))

        if reader.is_encrypted:
            raise HTTPException(
                status_code=400,
                detail="Encrypted PDFs are not supported",
            )

        # 8. Create the document record.
        document = Document(
            subject_id=subject.id,
            filename=original_filename,
            type="pdf",
            storage_ref=str(file_path),
            status="processing",
            document_metadata=None,
            created_at=datetime.now(timezone.utc),
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        # 9. Extract text and create chunks page by page.
        total_characters = 0
        total_chunks = 0

        for page_number, page in enumerate(
            reader.pages,
            start=1,
        ):
            page_text = page.extract_text() or ""
            total_characters += len(page_text)

            # Skip pages without extractable text.
            if not page_text.strip():
                continue

            # 10. Split the page into chunks.
            chunks = split_text(page_text)

            # 11. Save chunks with page numbers.
            for chunk_text in chunks:
                document_chunk = DocumentChunk(
                    document_id=document.id,
                    text=chunk_text,
                    page=page_number,
                    topic=None,
                    embedding_ref=None,
                )

                db.add(document_chunk)
                total_chunks += 1

        # 12. Commit the chunks.
        document.status = "processed"

        db.commit()
        db.refresh(document)

        print("PDF text extraction completed!")
        print("Extracted characters:", total_characters)
        print("Total chunks created:", total_chunks)

        # 13. Return processing results.
        return {
            "message": "File uploaded and processed successfully",
            "document_id": document.id,
            "filename": document.filename,
            "subject_id": subject.id,
            "user_id": current_user.id,
            "storage_ref": document.storage_ref,
            "status": document.status,
            "extracted_characters": total_characters,
            "chunks_created": total_chunks,
        }

    except HTTPException:
        db.rollback()

        if file_path and file_path.exists():
            file_path.unlink()

        raise

    except Exception:
        db.rollback()

        if file_path and file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail="The PDF could not be processed",
        )

    finally:
        await file.close()

# --------------------------------------------------
# CONVERSATION HISTORY AND RAG ENDPOINTS
# --------------------------------------------------

class AskQuestionRequest(BaseModel):
    question: str
    conversation_id: int | None = None


@app.get("/subjects/{subject_id}/conversations")
def get_subject_conversations(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List conversations belonging to the logged-in user for one subject."""
    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id,
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    conversations = (
        db.query(models.Conversation)
        .filter(
            models.Conversation.subject_id == subject_id,
            models.Conversation.user_id == current_user.id,
        )
        .order_by(models.Conversation.updated_at.desc())
        .all()
    )

    return [
        {
            "id": conversation.id,
            "subject_id": conversation.subject_id,
            "title": conversation.title,
            "created_at": conversation.created_at.isoformat(),
            "updated_at": conversation.updated_at.isoformat(),
        }
        for conversation in conversations
    ]


@app.get("/conversations/{conversation_id}/messages")
def get_conversation_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return messages only when the conversation belongs to the logged-in user."""
    conversation = db.query(models.Conversation).filter(
        models.Conversation.id == conversation_id,
        models.Conversation.user_id == current_user.id,
    ).first()

    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.conversation_id == conversation_id)
        .order_by(models.ChatMessage.created_at.asc(), models.ChatMessage.id.asc())
        .all()
    )

    return {
        "conversation_id": conversation.id,
        "subject_id": conversation.subject_id,
        "title": conversation.title,
        "messages": [
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "created_at": message.created_at.isoformat(),
            }
            for message in messages
        ],
    }


@app.post("/subjects/{subject_id}/ask")
def ask_study_material(
    subject_id: int,
    request: AskQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    import time

    total_start = time.perf_counter()
    question = request.question.strip()

    if not question:
        raise HTTPException(
            status_code=400,
            detail="Question cannot be empty.",
        )

    subject = db.query(Subject).filter(
        Subject.id == subject_id,
        Subject.user_id == current_user.id,
    ).first()

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    # Retrieve relevant chunks from this subject's uploaded material.
    search_start = time.perf_counter()
    try:
        chunks = search_chunks(
            query=question,
            top_k=3,
            subject_id=subject_id,
        )
    except Exception as error:
        print("SEMANTIC SEARCH ERROR:", repr(error))
        raise HTTPException(
            status_code=502,
            detail="Could not retrieve relevant study material.",
        )

    search_seconds = time.perf_counter() - search_start
    print(f"STUDYOS TIMING | Semantic search: {search_seconds:.2f}s")

    if not chunks:
        raise HTTPException(
            status_code=404,
            detail=(
                "No embedded study material was found for this subject. "
                "Upload a PDF and generate its embeddings first."
            ),
        )

    # Build the retrieved context and source metadata.
    context_parts = []
    sources = []

    for chunk in chunks:
        context_parts.append(
            f"Source page: {chunk['page']}\n{chunk['text']}"
        )
        sources.append(
            {
                "document_id": chunk["document_id"],
                "page": chunk["page"],
                "chunk_id": chunk["chunk_id"],
                "similarity": round(chunk["similarity"], 4),
            }
        )

    context = "\n\n---\n\n".join(context_parts)

    # Create a conversation, or verify that the supplied one belongs
    # to the current user and selected subject.
    now = datetime.now(timezone.utc)
    if request.conversation_id is None:
        conversation = models.Conversation(
            user_id=current_user.id,
            subject_id=subject.id,
            title=question[:80] or "New conversation",
            created_at=now,
            updated_at=now,
        )
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
    else:
        conversation = db.query(models.Conversation).filter(
            models.Conversation.id == request.conversation_id,
            models.Conversation.user_id == current_user.id,
            models.Conversation.subject_id == subject.id,
        ).first()

        if not conversation:
            raise HTTPException(
                status_code=404,
                detail="Conversation not found for this subject.",
            )

    # Load the recent history before saving this question, so the current
    # question is not duplicated in the conversation history prompt.
    previous_messages = (
        db.query(models.ChatMessage)
        .filter(models.ChatMessage.conversation_id == conversation.id)
        .order_by(
            models.ChatMessage.created_at.desc(),
            models.ChatMessage.id.desc(),
        )
        .limit(10)
        .all()
    )
    previous_messages.reverse()

    # Save the student's question.
    user_message = models.ChatMessage(
        conversation_id=conversation.id,
        role="user",
        content=question,
        created_at=now,
    )
    db.add(user_message)
    conversation.updated_at = now
    db.commit()
    db.refresh(user_message)

    history_text = "\n".join(
        f"{'Student' if message.role == 'user' else 'StudyOS'}: {message.content}"
        for message in previous_messages
    )
    if not history_text:
        history_text = "(No previous messages.)"

    # Generate a grounded answer using the fast Gemini Flash-Lite model.
    answer_start = time.perf_counter()
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="Gemini API key is not configured.",
            )

        gemini_client = genai.Client(api_key=api_key)
        response = gemini_client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=f"""
You are StudyOS, an educational study assistant.

Answer the student's latest question using ONLY the study material
provided below. You may use the conversation history to understand
references such as "it", "that", or "what are its types", but the
history is not a source of factual information.

Understand conversational wording and explain clearly. Keep the answer
concise unless the student asks for detail.

If the study material does not contain enough information to answer,
say so clearly. Do not invent facts or citations.

Cite source pages using [Page N]. Only cite page numbers present in the
study material below.

RECENT CONVERSATION:
{history_text}

STUDY MATERIAL:
{context}

STUDENT'S LATEST QUESTION:
{question}
""",
            config=types.GenerateContentConfig(
                thinking_config=types.ThinkingConfig(
                    thinking_level="low"
                )
            ),
        )

        answer = (response.text or "").strip()
        if not answer:
            raise HTTPException(
                status_code=502,
                detail="Gemini returned an empty answer.",
            )

    except HTTPException:
        raise
    except Exception as error:
        print("GEMINI ANSWER ERROR:", repr(error))
        raise HTTPException(
            status_code=502,
            detail="Could not generate an answer. Check the backend terminal.",
        )

    answer_seconds = time.perf_counter() - answer_start

    # Save the assistant's answer so it can be used in later turns.
    assistant_message = models.ChatMessage(
        conversation_id=conversation.id,
        role="assistant",
        content=answer,
        created_at=datetime.now(timezone.utc),
    )
    db.add(assistant_message)
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(assistant_message)

    total_seconds = time.perf_counter() - total_start
    print(f"STUDYOS TIMING | Gemini answer: {answer_seconds:.2f}s")
    print(f"STUDYOS TIMING | Total processing: {total_seconds:.2f}s")

    return {
        "conversation_id": conversation.id,
        "subject_id": subject.id,
        "subject_name": subject.name,
        "question": question,
        "answer": answer,
        "sources": sources,
        "message_id": assistant_message.id,
    }
