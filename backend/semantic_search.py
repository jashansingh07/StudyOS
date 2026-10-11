import os
import math

from dotenv import load_dotenv
from google import genai
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import DocumentChunk


# Load environment variables
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY was not found in .env")

client = genai.Client(api_key=api_key)


# Set this to True to inspect stored chunks without calling Gemini.
# Set it to False to perform normal semantic search.
DIAGNOSTIC_MODE = True

# Your small test PDF has document ID 10.
TEST_DOCUMENT_ID = 10


def generate_embedding(text: str) -> list[float]:
    """Generate an embedding using Gemini."""

    response = client.models.embed_content(
        model="gemini-embedding-001",
        contents=text,
    )

    return response.embeddings[0].values


def cosine_similarity(
    vector_a: list[float],
    vector_b: list[float],
) -> float:
    """Calculate cosine similarity between two vectors."""

    if len(vector_a) != len(vector_b):
        raise ValueError("Embedding dimensions do not match.")

    dot_product = sum(
        a * b for a, b in zip(vector_a, vector_b)
    )

    magnitude_a = math.sqrt(sum(a * a for a in vector_a))
    magnitude_b = math.sqrt(sum(b * b for b in vector_b))

    if magnitude_a == 0 or magnitude_b == 0:
        return 0.0

    return dot_product / (magnitude_a * magnitude_b)


def inspect_test_document() -> None:
    """Inspect embedded chunks from the small test PDF."""

    db: Session = SessionLocal()

    try:
        chunks = (
            db.query(DocumentChunk)
            .filter(
                DocumentChunk.document_id == TEST_DOCUMENT_ID,
                DocumentChunk.embedding.is_not(None),
            )
            .all()
        )

        print(f"Test document ID: {TEST_DOCUMENT_ID}")
        print(f"Chunks with embeddings: {len(chunks)}")

        if not chunks:
            print("No embedded chunks found for this document.")
            print(
                "Run generate_embeddings.py after your Gemini "
                "embedding quota becomes available."
            )
            return

        for chunk in chunks:
            print("\n" + "-" * 60)
            print(f"Chunk ID: {chunk.id}")
            print(f"Document ID: {chunk.document_id}")
            print(f"Page: {chunk.page}")
            print(f"Text:\n{chunk.text[:1000]}")

        print("\nDiagnostic inspection completed.")

    finally:
        db.close()


def search_chunks(
    query: str,
    top_k: int = 3,
) -> list[dict]:
    """Retrieve the most relevant embedded chunks."""

    if not query.strip():
        return []

    # Generate the query embedding.
    query_embedding = generate_embedding(query)

    db: Session = SessionLocal()

    try:
        chunks = (
            db.query(DocumentChunk)
            .filter(DocumentChunk.embedding.is_not(None))
            .all()
        )

        results = []
        seen_texts = set()

        for chunk in chunks:
            # Ignore duplicate text chunks.
            normalized_text = " ".join(chunk.text.split()).casefold()

            if normalized_text in seen_texts:
                continue

            seen_texts.add(normalized_text)

            score = cosine_similarity(
                query_embedding,
                chunk.embedding,
            )

            results.append(
                {
                    "chunk_id": chunk.id,
                    "document_id": chunk.document_id,
                    "page": chunk.page,
                    "text": chunk.text,
                    "similarity": score,
                }
            )

        results.sort(
            key=lambda result: result["similarity"],
            reverse=True,
        )

        return results[:top_k]

    finally:
        db.close()


def main() -> None:
    """Run diagnostic inspection or semantic search."""

    if DIAGNOSTIC_MODE:
        inspect_test_document()
        return

    query = input("Enter your study question: ").strip()

    if not query:
        print("Please enter a question.")
        return

    try:
        results = search_chunks(query)

        print("\nMost relevant chunks:\n")

        if not results:
            print("No embedded chunks found.")
            return

        for rank, result in enumerate(results, start=1):
            print(f"Rank: {rank}")
            print(f"Chunk ID: {result['chunk_id']}")
            print(f"Document ID: {result['document_id']}")
            print(f"Page: {result['page']}")
            print(f"Similarity: {result['similarity']:.4f}")
            print(f"Text: {result['text'][:500]}")
            print("-" * 60)

    except Exception as error:
        print(f"Search failed: {error}")


if __name__ == "__main__":
    main()