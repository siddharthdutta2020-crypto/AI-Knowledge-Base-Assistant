# Redis Pub/Sub Contract

Both `backend` and `python-ai` MUST agree on these exact channel names and payload
shapes. This is the only way the two services talk to each other — no direct
HTTP calls between them are allowed.

## Channels

| Channel            | Publisher   | Subscriber | Purpose                                   |
|--------------------|-------------|------------|--------------------------------------------|
| `pdf:process`       | backend     | python-ai  | Tell AI service to ingest a newly uploaded PDF |
| `pdf:processed`     | python-ai   | backend    | Report ingestion result / status update    |
| `ai:request`        | backend     | python-ai  | Ask a question (RAG pipeline)              |
| `ai:response`       | python-ai   | backend    | Return generated answer                    |

## Payloads

### `pdf:process` (backend → python-ai)
```json
{
  "requestId": "uuid-v4",
  "documentId": "mongo-object-id",
  "filePath": "/absolute/path/to/uploaded/file.pdf",
  "fileName": "original-name.pdf"
}
```

### `pdf:processed` (python-ai → backend)
```json
{
  "requestId": "uuid-v4",
  "documentId": "mongo-object-id",
  "status": "completed",       // "completed" | "failed"
  "chunkCount": 42,
  "error": null                 // string if status === "failed"
}
```

### `ai:request` (backend → python-ai)
```json
{
  "requestId": "uuid-v4",
  "sessionId": "session-uuid",
  "question": "How do I reset my password?"
}
```

### `ai:response` (python-ai → backend)
```json
{
  "requestId": "uuid-v4",
  "sessionId": "session-uuid",
  "answer": "You can reset your password by...",
  "sources": [
    { "documentName": "user-guide.pdf", "pageNumber": 12 }
  ],
  "suggestedQuestions": [
    "What happens if I forget my password?",
    "How can I update my email?",
    "Where can I change my profile settings?"
  ],
  "error": null
}
```

## Matching requests to responses

Every request carries a `requestId` (uuid). The backend keeps an in-memory map of
`requestId -> { resolve, reject, timeout }` (a "pending request" table). When the
matching response arrives on `ai:response` / `pdf:processed`, the backend resolves
the corresponding promise and clears the timeout. If no response arrives within
~30s, the backend rejects with a timeout error (this is your "Redis timeout"
error-handling case).
