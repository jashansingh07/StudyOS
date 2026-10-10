import os
import uuid

from datetime import datetime, timezone

from pypdf import PdfReader

from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    UploadFile,
    File
)

from fastapi.security import (
    OAuth2PasswordRequestForm,
    OAuth2PasswordBearer
)

from sqlalchemy.orm import Session

from app.database import get_db

from app.models import (
    User,
    Subject,
    Document,
    DocumentChunk
)

from app.chunking import split_text

from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    verify_access_token
)


# --------------------------------------------------
# CONFIGURATION
# --------------------------------------------------

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB

oauth2_scheme = OAuth2PasswordBearer(
    tokenUrl="/login"
)


# --------------------------------------------------
# FASTAPI APPLICATION
# --------------------------------------------------

app = FastAPI(
    title="StudyOS API",
    description="AI Academic Mentor & Multi-Source Learning Platform",
    version="0.1.0"
)


# --------------------------------------------------
# ROOT AND HEALTH CHECK
# --------------------------------------------------

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


# --------------------------------------------------
# CREATE USER
# --------------------------------------------------

@app.post("/users")
def create_user(
    name: str,
    email: str,
    password: str,
    db: Session = Depends(get_db)
):
    existing_user = db.query(User).filter(
        User.email == email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail="Email is already registered"
        )

    user = User(
        name=name,
        email=email,
        password_hash=hash_password(password)
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email
    }


# --------------------------------------------------
# GET USER
# --------------------------------------------------

@app.get("/users/{user_id}")
def get_user(
    user_id: int,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.id == user_id
    ).first()

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


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

@app.post("/login")
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(
        User.email == form_data.username
    ).first()

    if not user or not user.password_hash:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    if not verify_password(
        form_data.password,
        user.password_hash
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )

    access_token = create_access_token(user.id)

    return {
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email
    }


# --------------------------------------------------
# AUTHENTICATED USER DEPENDENCY
# --------------------------------------------------

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    user_id = verify_access_token(token)

    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )

    user = db.query(User).filter(
        User.id == user_id
    ).first()

    if not user:
        raise HTTPException(
            status_code=401,
            detail="User not found"
        )

    return user


# --------------------------------------------------
# GET CURRENT USER
# --------------------------------------------------

@app.get("/me")
def me(
    current_user: User = Depends(get_current_user)
):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email
    }


# --------------------------------------------------
# GET USER SUBJECTS
# --------------------------------------------------

@app.get("/users/{user_id}/subjects")
def get_user_subjects(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You are not allowed to access this user's subjects"
        )

    subjects = db.query(Subject).filter(
        Subject.user_id == current_user.id
    ).all()

    return [
        {
            "id": subject.id,
            "name": subject.name,
            "user_id": subject.user_id
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
    db: Session = Depends(get_db)
):
    subject = Subject(
        name=name,
        user_id=current_user.id
    )

    db.add(subject)
    db.commit()
    db.refresh(subject)

    return {
        "id": subject.id,
        "name": subject.name,
        "user_id": subject.user_id
    }


# --------------------------------------------------
# UPLOAD AND PROCESS PDF
# --------------------------------------------------

@app.post("/subjects/{subject_id}/documents")
async def upload_document(
    subject_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    file_path = None

    try:
        # 1. Verify subject ownership
        subject = db.query(Subject).filter(
            Subject.id == subject_id,
            Subject.user_id == current_user.id
        ).first()

        if not subject:
            raise HTTPException(
                status_code=404,
                detail="Subject not found"
            )

        # 2. Validate filename and extension
        if (
            not file.filename
            or not file.filename.lower().endswith(".pdf")
        ):
            raise HTTPException(
                status_code=400,
                detail="Only PDF files are supported"
            )

        # 3. Create upload directory
        upload_dir = "uploads"
        os.makedirs(upload_dir, exist_ok=True)

        # 4. Generate a unique storage filename
        original_filename = os.path.basename(file.filename)
        unique_filename = f"{uuid.uuid4()}.pdf"

        file_path = os.path.join(
            upload_dir,
            unique_filename
        )

        # 5. Read the file with a 10 MB limit
        content = await file.read(MAX_FILE_SIZE + 1)

        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail="File too large. Maximum allowed size is 10 MB."
            )

        if not content:
            raise HTTPException(
                status_code=400,
                detail="The uploaded file is empty"
            )

        # 6. Save the uploaded file
        with open(file_path, "wb") as buffer:
            buffer.write(content)

        # 7. Open and validate the PDF
        reader = PdfReader(file_path)

        if reader.is_encrypted:
            raise HTTPException(
                status_code=400,
                detail="Encrypted PDFs are not supported"
            )

        # 8. Create the document record
        document = Document(
            subject_id=subject.id,
            filename=original_filename,
            type="pdf",
            storage_ref=file_path,
            status="processing",
            document_metadata=None,
            created_at=datetime.now(timezone.utc)
        )

        db.add(document)
        db.commit()
        db.refresh(document)

        # 9. Extract text and create chunks page by page
        total_characters = 0
        total_chunks = 0

        for page_number, page in enumerate(
            reader.pages,
            start=1
        ):
            page_text = page.extract_text() or ""

            total_characters += len(page_text)

            # Skip pages without extractable text
            if not page_text.strip():
                continue

            # 10. Split the page into chunks
            chunks = split_text(page_text)

            # 11. Save chunks with page numbers
            for chunk_text in chunks:
                document_chunk = DocumentChunk(
                    document_id=document.id,
                    text=chunk_text,
                    page=page_number,
                    topic=None,
                    embedding_ref=None
                )

                db.add(document_chunk)
                total_chunks += 1

        # 12. Commit the chunks
        document.status = "processed"

        db.commit()
        db.refresh(document)

        print("PDF text extraction completed!")
        print("Extracted characters:", total_characters)
        print("Total chunks created:", total_chunks)
        print("Chunks saved to database:", total_chunks)

        # 13. Return processing results
        return {
            "message": "File uploaded and processed successfully",
            "document_id": document.id,
            "filename": document.filename,
            "subject_id": subject.id,
            "user_id": current_user.id,
            "storage_ref": document.storage_ref,
            "status": document.status,
            "extracted_characters": total_characters,
            "chunks_created": total_chunks
        }

    except HTTPException:
        # Roll back pending database changes
        db.rollback()

        # Remove the saved file if processing failed
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

        raise

    except Exception:
        # Roll back pending database changes
        db.rollback()

        # Remove the saved file if processing failed
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

        raise HTTPException(
            status_code=500,
            detail="The PDF could not be processed"
        )

    finally:
        await file.close()