from typing import TypedDict, List, Optional
import os

from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END

from app.ingestion.vector_store import get_vector_store


# -----------------------------
# Types
# -----------------------------

class Source(TypedDict):
    documentName: str
    pageNumber: Optional[int]


class GraphState(TypedDict):
    session_id: str
    question: str
    history: List[dict]

    retrieved_context: str
    sources: List[Source]

    answer: str
    suggested_questions: List[str]


# -----------------------------
# Local LLM
# -----------------------------

llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash",
    google_api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0,
)


# -----------------------------
# Retrieve Context
# -----------------------------

def retrieve_context(state: GraphState):

    store = get_vector_store()

    docs = store.similarity_search(
        state["question"],
        k=6,
    )

    context_parts = []
    sources = []
    seen = set()

    for doc in docs:

        context_parts.append(doc.page_content)

        name = doc.metadata.get("document_name", "Unknown.pdf")
        page = doc.metadata.get("page_number")

        if (name, page) not in seen:
            seen.add((name, page))
            sources.append(
                {
                    "documentName": name,
                    "pageNumber": page,
                }
            )

    state["retrieved_context"] = "\n\n-----------------------------\n\n".join(
        context_parts
    )

    state["sources"] = sources

    print("\n================ RETRIEVED CONTEXT ================\n")
    print(state["retrieved_context"][:5000])
    print("\n===================================================\n")

    return state


# -----------------------------
# Generate Answer
# -----------------------------

def generate_answer(state: GraphState):

    context = state["retrieved_context"].strip()

    if len(context) == 0:
        state["answer"] = (
            "I couldn't find any relevant information in the uploaded documents."
        )
        return state

    history = ""

    for item in state.get("history", [])[-5:]:
        history += f"""
User: {item["question"]}
Assistant: {item["answer"]}
"""

    prompt = f"""
You are an intelligent PDF assistant.

Your ONLY job is to answer using the provided document.

Never say:

"I don't know"

unless the information truly does not exist.

If the answer exists anywhere in the context,
summarize it naturally.

Conversation History:

{history}

DOCUMENT:

{context}

QUESTION:

{state["question"]}

Write a detailed answer using only the document.
"""

    response = llm.invoke(prompt)

    state["answer"] = response.content.strip()

    print("\n================ ANSWER ================\n")
    print(state["answer"])
    print("\n========================================\n")

    return state


# -----------------------------
# Suggested Questions
# -----------------------------

def generate_suggested_questions(state: GraphState):

    prompt = f"""
Based ONLY on the answer below, generate 5 follow-up questions.

Return ONLY the questions.

Answer:

{state["answer"]}
"""

    response = llm.invoke(prompt)

    questions = []

    for line in response.content.split("\n"):

        line = (
            line.replace("-", "")
            .replace("*", "")
            .strip()
        )

        if "." in line[:4]:
            line = line.split(".", 1)[1].strip()

        if line:
            questions.append(line)

    state["suggested_questions"] = questions[:5]

    return state


# -----------------------------
# Return
# -----------------------------

def return_response(state: GraphState):
    return state


# -----------------------------
# Graph
# -----------------------------

def build_graph():

    graph = StateGraph(GraphState)

    graph.add_node(
        "retrieve_context",
        retrieve_context,
    )

    graph.add_node(
        "generate_answer",
        generate_answer,
    )

    graph.add_node(
        "generate_suggested_questions",
        generate_suggested_questions,
    )

    graph.add_node(
        "return_response",
        return_response,
    )

    graph.set_entry_point("retrieve_context")

    graph.add_edge(
        "retrieve_context",
        "generate_answer",
    )

    graph.add_edge(
        "generate_answer",
        "generate_suggested_questions",
    )

    graph.add_edge(
        "generate_suggested_questions",
        "return_response",
    )

    graph.add_edge(
        "return_response",
        END,
    )

    return graph.compile()


rag_graph = build_graph()