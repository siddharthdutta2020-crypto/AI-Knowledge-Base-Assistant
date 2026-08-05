import os
import traceback
import tempfile

from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document

import pytesseract
from PIL import Image
from pdf2image import convert_from_path

from app.config import settings
from app.ingestion.vector_store import (
    get_vector_store,
    delete_document_vectors,
)


def extract_text_with_ocr(pdf_path: str):
    """
    Fallback OCR for scanned/image PDFs.
    Returns LangChain Document objects.
    """

    documents = []

    images = convert_from_path(pdf_path)

    for page_number, image in enumerate(images):
        text = pytesseract.image_to_string(image)

        documents.append(
            Document(
                page_content=text,
                metadata={
                    "page": page_number,
                },
            )
        )

    return documents

def ingest_pdf(document_id: str, file_path: str, file_name: str) -> int:
    """
    Loads a PDF, splits it into chunks, tags each chunk with metadata,
    embeds them, and stores them in Qdrant.
    """

    print("\n========== PDF INGEST DEBUG ==========")

    abs_path = os.path.abspath(file_path)

    print("Original file path :", file_path)
    print("Resolved path      :", abs_path)
    print("Exists             :", os.path.exists(abs_path))
    print("Is file            :", os.path.isfile(abs_path))
    print("Current directory  :", os.getcwd())

    print("======================================\n")

    if not os.path.exists(abs_path):
        raise FileNotFoundError(f"PDF not found: {abs_path}")

    # Delete previous vectors if reprocessing
    try:
        delete_document_vectors(document_id)
    except Exception:
        pass

    print("Loading PDF...")

    loader = PyPDFLoader(abs_path)
    pages = loader.load()

    print(f"Loaded {len(pages)} pages")

    has_text = any(page.page_content.strip() for page in pages)

    if not has_text:
        print("\nNo extractable text found.")
        print("Falling back to OCR...\n")

        pages = extract_text_with_ocr(abs_path)

        print(f"OCR extracted {len(pages)} pages")

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
    )

    chunks = splitter.split_documents(pages)

    print(f"Created {len(chunks)} chunks")

    for chunk in chunks:
        page = chunk.metadata.get("page")

        chunk.metadata.update(
            {
                "document_id": document_id,
                "document_name": file_name,
                "page_number": page + 1 if page is not None else None,
            }
        )

    if chunks:

        print("Creating vector store...")

        store = get_vector_store()

        print("Vector store created")

        print(f"Adding {len(chunks)} chunks to Qdrant...")

        try:
            store.add_documents(chunks)
            print("SUCCESS: Documents added successfully.")
        except Exception:
            print("\n========== ADD_DOCUMENTS ERROR ==========\n")
            traceback.print_exc()
            print("\n=========================================\n")
            raise

    return len(chunks)