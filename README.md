# PDF Knowledge Base AI Chatbot (RAG System)

A microservice-based RAG chatbot: admins upload PDFs, the system chunks/embeds/stores
them in a vector DB, and a public chatbot answers questions using that knowledge base
with source citations and suggested follow-up questions.

## Architecture

```
Next.js Frontend (TS, Tailwind, shadcn)
        │  REST (fetch)
        ▼
Node.js Backend (Express, TS, MongoDB)
        │  Redis Pub/Sub  (mandatory — no direct HTTP between backend and AI service)
        ▼
Python AI Service (FastAPI, LangChain, LangGraph)
        │
        ▼
Qdrant (vector store)  +  MongoDB (metadata / chat history)
```

**Redis Pub/Sub contract** (channels + payload shapes) is documented in
[`shared/redis-contract.md`](./shared/redis-contract.md) — both services implement it exactly.

**LangGraph workflow** (`python-ai/app/graph/workflow.py`) has the four mandatory nodes:
`retrieve_context → generate_answer → generate_suggested_questions → return_response`.

## Project Structure

```
frontend/     Next.js App Router (TypeScript, Tailwind, shadcn-style components)
backend/      Express + TypeScript + MongoDB (admin auth, PDF upload, chat APIs)
python-ai/    FastAPI + LangChain + LangGraph (RAG pipeline, Redis listener)
shared/       Redis Pub/Sub contract (shared reference, not a runtime dependency)
docker-compose.yml   MongoDB, Redis, Qdrant containers
```

## Prerequisites
- Node.js 18+
- Python 3.10+
- Docker (for Mongo / Redis / Qdrant) — or run these three yourself locally
- An OpenAI API key (or swap `python-ai/app/graph/workflow.py` and
  `app/ingestion/vector_store.py` for any other LangChain-supported LLM/embedding provider)

## Setup

### 1. Start infrastructure
```bash
docker compose up -d
```
This starts MongoDB (`27017`), Redis (`6379`), and Qdrant (`6333`).

### 2. Backend
```bash
cd backend
cp .env.example .env      # fill in JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, etc.
npm install
npm run build && npm run seed   # or: npx ts-node src/utils/seedAdmin.ts
npm run dev
```
Backend runs on `http://localhost:5000`.

> Note: add a `"seed": "ts-node src/utils/seedAdmin.ts"` script to `package.json` if you
> want `npm run seed` to work verbatim, or just run the `ts-node` command directly.

### 3. Python AI Service
```bash
cd python-ai
cp .env.example .env       # fill in OPENAI_API_KEY, etc.
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
This process subscribes to Redis and starts serving — the FastAPI HTTP port is only
used for `/health`, since all real communication with the backend happens over Redis.

### 4. Frontend
```bash
cd frontend
cp .env.example .env.local     # NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
npm install
npm run dev
```
Frontend runs on `http://localhost:3000`.
- Public chat: `http://localhost:3000/chat`
- Admin login: `http://localhost:3000/admin/login`

## Database Schema

**MongoDB collections** (see `backend/src/models/`):

| Collection | Fields |
|---|---|
| `users` | `_id`, `email`, `password` (bcrypt-hashed) |
| `documents` | `_id`, `fileName`, `filePath`, `uploadDate`, `processingStatus` (`pending`/`processing`/`completed`/`failed`), `chunkCount`, `error` |
| `chats` | `_id`, `sessionId`, `question`, `answer`, `sources[]`, `suggestedQuestions[]`, `timestamp` |

**Vector DB (Qdrant)**: one collection (`kb_documents`), each point tagged with
metadata `{ document_id, document_name, page_number }` for source citation.

## API Documentation

### Admin APIs (require `Authorization: Bearer <token>`)
| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | Admin login → returns JWT |
| POST | `/api/documents/upload` | Upload a PDF (multipart `file` field) |
| GET | `/api/documents?search=` | List / search uploaded PDFs |
| DELETE | `/api/documents/:id` | Delete a PDF |
| POST | `/api/documents/:id/reprocess` | Re-run ingestion for a PDF |
| GET | `/api/dashboard` | Dashboard stats (4 metrics + recent docs) |

### Chat APIs (public, no auth)
| Method | Path | Description |
|---|---|---|
| POST | `/api/chat/ask` | Body: `{ sessionId, question }` → answer + sources + suggested questions |
| GET | `/api/chat/history/:sessionId` | Full conversation history for a session |

## Notes on the "streaming responses" requirement
The mandated architecture requires all backend ↔ AI-service communication to go over
Redis Pub/Sub, which delivers one discrete message per response — it doesn't support
token-level streaming the way a direct HTTP/SSE connection would. The frontend
(`frontend/src/app/chat/page.tsx`) reveals the completed answer progressively
(word-by-word) to deliver the streaming UX, with a typing indicator shown while
waiting for the backend/AI service round trip.

## Environment Variables
See `.env.example` in each of `backend/`, `python-ai/`, and `frontend/`.

## What's Included vs. Left as TODO
This scaffold implements the full architecture end-to-end and has been verified to
**compile/build cleanly** (`tsc --noEmit` on backend, `next build` on frontend,
`py_compile` on the Python service). Two things need your own environment to
verify at runtime, since they depend on live services not available in this build
environment:
1. An actual OpenAI (or other LLM) API key for `python-ai` to generate real answers.
2. Running Mongo/Redis/Qdrant containers to test the full request round trip.

Everything else — auth, upload pipeline, dashboard, chat UI, LangGraph workflow,
Redis contract — is implemented per the assignment spec with no extra features added.
