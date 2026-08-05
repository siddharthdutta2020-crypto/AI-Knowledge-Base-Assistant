from collections import defaultdict
from typing import List, Dict

# NOTE: in-memory is fine for a single-process demo/assignment. For production,
# persist this in MongoDB (the `Chats` collection already stores full history,
# so this could be replaced with a lookup against the backend/DB instead).
_session_history: Dict[str, List[dict]] = defaultdict(list)

MAX_TURNS_KEPT = 10


def get_history(session_id: str) -> List[dict]:
    return _session_history[session_id]


def append_turn(session_id: str, question: str, answer: str) -> None:
    history = _session_history[session_id]
    history.append({"question": question, "answer": answer})
    if len(history) > MAX_TURNS_KEPT:
        _session_history[session_id] = history[-MAX_TURNS_KEPT:]
