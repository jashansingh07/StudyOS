import os
from dotenv import load_dotenv
from google import genai

# Load environment variables from .env
load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    raise ValueError("GEMINI_API_KEY was not found in .env")

# Initialize the Gemini client
client = genai.Client(api_key=api_key)

# Sample text from an academic subject
text = "An operating system manages computer hardware and software resources."

# Generate an embedding
response = client.models.embed_content(
    model="gemini-embedding-001",
    contents=text
)

embedding = response.embeddings[0].values

print("Embedding generated successfully!")
print("Number of dimensions:", len(embedding))
print("First 5 values:", embedding[:5])