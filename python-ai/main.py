import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.redis.listener import start_listener


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start the Redis listener as a background task when the service boots.
    listener_task = asyncio.create_task(start_listener())
    yield
    listener_task.cancel()


app = FastAPI(title="Knowledge Base AI Service", lifespan=lifespan)


@app.get("/health")
async def health():
    """
    Health check only. Per the assignment spec, the backend must NOT call this
    service directly for AI processing — all real communication happens over
    Redis Pub/Sub (see app/redis/listener.py).
    """
    return {"status": "ok"}
