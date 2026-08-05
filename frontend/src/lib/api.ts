const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:5001/api";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("admin_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  authRequired = false
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };

  if (authRequired) {
    const token = getToken();

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.error || `Request failed with status ${res.status}`
    );
  }

  return data as T;
}

export const api = {
  // -------------------------
  // Authentication
  // -------------------------
  login: (email: string, password: string) =>
    request<{ token: string; email: string }>(
      "/auth/login",
      {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
        }),
      }
    ),

  // -------------------------
  // Dashboard
  // -------------------------
  getDashboard: () =>
    request("/dashboard", {}, true),

  // -------------------------
  // Documents
  // -------------------------
  listDocuments: (search = "") =>
    request(
      `/documents${
        search ? `?search=${encodeURIComponent(search)}` : ""
      }`,
      {},
      true
    ),

  uploadDocument: (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  return request<{
    document: {
      _id: string;
      fileName: string;
    };
  }>(
    "/documents/upload",
    {
      method: "POST",
      body: formData,
    },
    true
  );
},

  deleteDocument: (id: string) =>
    request(
      `/documents/${id}`,
      {
        method: "DELETE",
      },
      true
    ),

  reprocessDocument: (id: string) =>
    request(
      `/documents/${id}/reprocess`,
      {
        method: "POST",
      },
      true
    ),

  // -------------------------
  // Chat
  // -------------------------
  askQuestion: (
    sessionId: string,
    question: string
  ) =>
    request<{
      answer: string;
      sources: {
        documentName: string;
        pageNumber?: number;
      }[];
      suggestedQuestions: string[];
    }>(
      "/chat/ask",
      {
        method: "POST",
        body: JSON.stringify({
          sessionId,
          question,
        }),
      }
    ),

  getChatHistory: (sessionId: string) =>
  request(`/chat/history/${sessionId}`),

getChatSessions: () =>
  request<{
    sessions: {
      sessionId: string;
      title: string;
      lastUpdated: string;
    }[];
  }>("/chat/sessions"),
};