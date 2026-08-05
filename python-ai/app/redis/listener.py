import asyncio
import json
import traceback

import redis.asyncio as aioredis

from app.config import settings
from app.graph.workflow import rag_graph
from app.ingestion.pipeline import ingest_pdf
from app.memory import append_turn, get_history


async def handle_ai_request(payload: dict, publisher: aioredis.Redis) -> None:
    request_id = payload.get("requestId")
    session_id = payload.get("sessionId")
    question = payload.get("question")

    try:
        print("\n================ AI REQUEST ================")
        print(json.dumps(payload, indent=2))
        print("============================================\n")

        result = rag_graph.invoke(
            {
                "session_id": session_id,
                "question": question,
                "history": get_history(session_id),
            }
        )

        append_turn(session_id, question, result["answer"])

        response = {
            "requestId": request_id,
            "sessionId": session_id,
            "answer": result["answer"],
            "sources": result["sources"],
            "suggestedQuestions": result["suggested_questions"],
            "error": None,
        }

        print("\n================ AI SUCCESS ================")
        print(json.dumps(response, indent=2))
        print("============================================\n")

    except Exception:
        print("\n================ AI ERROR ==================")
        traceback.print_exc()
        print("============================================\n")

        response = {
            "requestId": request_id,
            "sessionId": session_id,
            "answer": "",
            "sources": [],
            "suggestedQuestions": [],
            "error": traceback.format_exc(),
        }

    await publisher.publish(
        settings.CHANNEL_AI_RESPONSE,
        json.dumps(response),
    )


async def handle_pdf_process(payload: dict, publisher: aioredis.Redis) -> None:
    request_id = payload.get("requestId")
    document_id = payload.get("documentId")
    file_path = payload.get("filePath")
    file_name = payload.get("fileName")

    try:
        print("\n================ PDF REQUEST ================")
        print(json.dumps(payload, indent=2))
        print("=============================================\n")

        chunk_count = ingest_pdf(
            document_id=document_id,
            file_path=file_path,
            file_name=file_name,
        )

        response = {
            "requestId": request_id,
            "documentId": document_id,
            "status": "completed",
            "chunkCount": chunk_count,
            "error": None,
        }

        print("\n================ PDF SUCCESS ================")
        print(json.dumps(response, indent=2))
        print("=============================================\n")

    except Exception:
        print("\n================ PDF ERROR ==================")
        traceback.print_exc()
        print("=============================================\n")

        response = {
            "requestId": request_id,
            "documentId": document_id,
            "status": "failed",
            "chunkCount": 0,
            "error": traceback.format_exc(),
        }

        print("\n============= RESPONSE TO BACKEND ===========")
        print(json.dumps(response, indent=2))
        print("=============================================\n")

    await publisher.publish(
        settings.CHANNEL_PDF_PROCESSED,
        json.dumps(response),
    )


async def start_listener() -> None:
    redis_client = aioredis.from_url(
        settings.REDIS_URL,
        decode_responses=True,
    )

    pubsub = redis_client.pubsub()

    await pubsub.subscribe(
        settings.CHANNEL_AI_REQUEST,
        settings.CHANNEL_PDF_PROCESS,
    )

    print(f"[redis] subscribed to {settings.CHANNEL_AI_REQUEST}")
    print(f"[redis] subscribed to {settings.CHANNEL_PDF_PROCESS}")

    async for message in pubsub.listen():

        if message["type"] != "message":
            continue

        print("\n============== REDIS MESSAGE ================")
        print("Channel :", message["channel"])
        print("Payload :", message["data"])
        print("=============================================\n")

        try:
            payload = json.loads(message["data"])
        except json.JSONDecodeError:
            print("[redis] Invalid JSON received.")
            continue

        if message["channel"] == settings.CHANNEL_AI_REQUEST:
            asyncio.create_task(
                handle_ai_request(payload, redis_client)
            )

        elif message["channel"] == settings.CHANNEL_PDF_PROCESS:
            asyncio.create_task(
                handle_pdf_process(payload, redis_client)
            )