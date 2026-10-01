# StudyOS Architecture

## 1. Overview

StudyOS is an AI-powered academic learning platform.

Its goal is to help students:

- Understand course material
- Practice questions
- Identify weak topics
- Create personalized study plans
- Track their learning progress

---

## 2. High-Level Architecture

```text
                    STUDYOS
                       |
              +--------+--------+
              |                 |
              v                 v
         Next.js            FastAPI
         Frontend            Backend
              |                 |
              |                 v
              |            PostgreSQL
              |                 |
              |        +--------+--------+
              |        |        |        |
              |        v        v        v
              |      Users   Subjects  Documents
              |
              +------------------------+
                       |
                       v
                  AI / RAG Layer
                       |
              +--------+--------+
              |        |        |
              v        v        v
          Processing  Vector   LLM
                      Database