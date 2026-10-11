import os
import argparse

from dotenv import load_dotenv
from google import genai
from sqlalchemy.orm import Session
from google.genai import errors

from app.database import SessionLocal
from app.models import DocumentChunk


# Load environment variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY was not found in .env")

client = genai.Client(api_key=api_key)


def generate_embedding(text: str) -> list[float]:
    """Generate an embedding using Gemini."""

    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
    )

    return response.embeddings[0].values


def main():
    parser = argparse.ArgumentParser(
        description="Generate embeddings for document chunks."
    )

    parser.add_argument(
        "--document-id",
        type=int,
        help="Process only chunks belonging to this document ID.",
    )

    parser.add_argument(
        "--limit",
        type=int,
        help="Maximum number of chunks to process.",
    )

    args = parser.parse_args()

    db: Session = SessionLocal()

    try:
        query = db.query(DocumentChunk).filter(
            DocumentChunk.embedding.is_(None)
        )

        if args.document_id is not None:
            query = query.filter(
                DocumentChunk.document_id == args.document_id
            )

        query = query.order_by(DocumentChunk.id)

        if args.limit is not None:
            if args.limit < 1:
                raise ValueError("--limit must be at least 1.")
            query = query.limit(args.limit)

        chunks = query.all()

        if not chunks:
            print("No matching chunks need embeddings.")
            return

        print(f"Found {len(chunks)} chunks without embeddings.")

        for chunk in chunks:
            print(
                f"Generating embedding for chunk {chunk.id} "
                f"(document {chunk.document_id})..."
            )

            try:
                embedding = generate_embedding(chunk.text)

            except errors.APIError as error:
                db.rollback()

                if getattr(error, "code", None) == 429:
                    print("\nGemini quota or rate limit reached.")
                    print("Successfully saved earlier embeddings remain stored.")
                    print("Stop here and retry after quota becomes available.")
                    return

                raise

            chunk.embedding = embedding
            db.commit()

            print(
                f"Saved embedding for chunk {chunk.id} "
                f"({len(embedding)} dimensions)"
            )

        print("\nEmbedding generation completed.")

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()