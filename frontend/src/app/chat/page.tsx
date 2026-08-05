"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

interface DisplayMessage {
  role: "user" | "assistant";
  content: string;
  sources?: {
    documentName: string;
    pageNumber?: number;
  }[];
  suggestedQuestions?: string[];
  isStreaming?: boolean;
}

interface ChatHistoryItem {
  sessionId: string;
  title: string;
}

export default function ChatPage() {
  const [sessionId, setSessionId] = useState(() =>
    crypto.randomUUID()
  );

  const [messages, setMessages] = useState<
    DisplayMessage[]
  >([]);

  const [chatHistory, setChatHistory] =
    useState<ChatHistoryItem[]>([]);

  const [input, setInput] = useState("");

  const [loading, setLoading] =
    useState(false);

  const bottomRef =
    useRef<HTMLDivElement>(null);

    useEffect(() => {
  bottomRef.current?.scrollIntoView({
    behavior: "smooth",
  });
}, [messages]);

useEffect(() => {
  loadChatSessions();
}, []);


  async function sendQuestion(question: string) {
    if (!question.trim() || loading) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: question,
      },
    ]);

    setInput("");

    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "",
        isStreaming: true,
      },
    ]);

    try {
      const res =
        (await api.askQuestion(
          sessionId,
          question
        )) as {
          answer: string;
          sources: {
            documentName: string;
            pageNumber?: number;
          }[];

          suggestedQuestions: string[];
        };

      await streamRevealAnswer(
        res.answer,
        res.sources,
        res.suggestedQuestions
      );
    } catch (err: any) {
      setMessages((prev) => {
        const next = [...prev];

        next[next.length - 1] = {
          role: "assistant",
          content:
            err.message ||
            "Something went wrong.",
        };

        return next;
      });
    } finally {
      setLoading(false);

      loadChatSessions();
    }
  }

  function streamRevealAnswer(
    answer: string,
    sources: {
      documentName: string;
      pageNumber?: number;
    }[],
    suggestedQuestions: string[]
  ) {
    return new Promise<void>((resolve) => {
      const words = answer.split(" ");

      let i = 0;

      const timer = setInterval(() => {
        i += 3;

        const partial = words
          .slice(0, i)
          .join(" ");

        setMessages((prev) => {
          const next = [...prev];

          next[next.length - 1] = {
            role: "assistant",
            content: partial,
            isStreaming:
              i < words.length,
            sources:
              i >= words.length
                ? sources
                : undefined,
            suggestedQuestions:
              i >= words.length
                ? suggestedQuestions
                : undefined,
          };

          return next;
        });

        if (i >= words.length) {
          clearInterval(timer);
          resolve();
        }
      }, 40);
    });
  }

  function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    sendQuestion(input);
  }

  function startNewChat() {
  setMessages([]);
  setInput("");

  const newSessionId = crypto.randomUUID();

  setSessionId(newSessionId);

  // Reload sidebar
  loadChatSessions();
}

  async function loadHistory(
    historySessionId: string
  ) {
    try {
      const res =
        (await api.getChatHistory(
          historySessionId
        )) as any;

      const converted =
        res.chats.flatMap((chat: any) => [
          {
            role: "user",
            content: chat.question,
          },
          {
            role: "assistant",
            content: chat.answer,
            sources: chat.sources,
            suggestedQuestions:
              chat.suggestedQuestions,
          },
        ]);

      setSessionId(
        historySessionId
      );

      setMessages(converted);
    } catch (err) {
      console.error(err);
    }
  }

async function loadChatSessions() {
  try {
    const res = (await api.getChatSessions()) as {
      sessions: {
        sessionId: string;
        title: string;
      }[];
    };

    setChatHistory(res.sessions);
  } catch (err) {
    console.error("Failed to load chat sessions", err);
  }
}

    return (
    <div className="flex h-screen bg-background">

      {/* Sidebar */}
      <aside className="w-72 border-r bg-muted/30 flex flex-col">

        <div className="p-4 border-b">

          <Button
            className="w-full"
            onClick={startNewChat}
          >
            + New Chat
          </Button>

        </div>

        <div className="flex-1 overflow-y-auto p-3">

          <h2 className="mb-3 text-sm font-semibold text-muted-foreground">
            Chat History
          </h2>

          {chatHistory.length === 0 ? (

            <p className="text-sm text-muted-foreground">
              No previous chats
            </p>

          ) : (

            <div className="space-y-2">

              {chatHistory.map((chat) => (

                <button
                  key={chat.sessionId}
                  onClick={() => loadHistory(chat.sessionId)}
                  className="w-full rounded-lg border bg-background p-3 text-left transition hover:bg-muted"
                >
                  <p className="truncate text-sm font-medium">
                    {chat.title}
                  </p>
                </button>

              ))}

            </div>

          )}

        </div>

      </aside>

      {/* Main Chat */}
      <main className="flex flex-1 flex-col">

        {/* Header */}
        <div className="flex items-center justify-between border-b p-4">

          <div>

            <h1 className="text-2xl font-bold">
              Knowledge Base Assistant
            </h1>

            <p className="text-sm text-muted-foreground">
              Ask questions about uploaded documents.
            </p>

          </div>

          <Link href="/admin/login">

            <Button variant="outline">
              Admin Login
            </Button>

          </Link>

        </div>

        {/* Messages */}

        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {messages.length === 0 && (

            <div className="mx-auto mt-20 max-w-xl text-center">

              <h2 className="mb-3 text-2xl font-semibold">
                Welcome 👋
              </h2>

              <p className="text-muted-foreground">
                Ask anything about the uploaded knowledge base.
              </p>

              <div className="mt-8 rounded-xl border bg-muted/40 p-5">

                <h3 className="mb-3 font-medium">
                  Try asking:
                </h3>

                <ul className="space-y-2 text-left text-sm">

                  <li>• Summarize the uploaded document.</li>

                  <li>• What technologies are used?</li>

                  <li>• Explain the project requirements.</li>

                  <li>• Give me the evaluation criteria.</li>

                </ul>

              </div>

            </div>

          )}

          {messages.map((msg, idx) => (

            <div
              key={idx}
              className={
                msg.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >

              <div
                className={
                  msg.role === "user"
                    ? "max-w-2xl rounded-2xl bg-primary px-5 py-3 text-primary-foreground"
                    : "max-w-2xl rounded-2xl bg-muted px-5 py-3"
                }
              >

                {msg.role === "assistant" &&
                msg.isStreaming &&
                msg.content === "" ? (

                  <TypingIndicator />

                ) : msg.role === "assistant" ? (

                  <div className="prose prose-sm max-w-none">

                    <ReactMarkdown>
                      {msg.content}
                    </ReactMarkdown>

                  </div>

                ) : (

                  msg.content

                )}

                {msg.sources &&
                  msg.sources.length > 0 && (

                  <div className="mt-4 border-t pt-3 text-xs text-muted-foreground">

                    <strong>Sources:</strong>

                    <br />

                    {msg.sources
                      .map(
                        (s) =>
                          `${s.documentName}${
                            s.pageNumber
                              ? ` (p. ${s.pageNumber})`
                              : ""
                          }`
                      )
                      .join(", ")}

                  </div>

                )}

                {msg.suggestedQuestions &&
                  msg.suggestedQuestions.length > 0 && (

                  <div className="mt-4 flex flex-wrap gap-2">

                    {msg.suggestedQuestions.map((q, i) => (

                      <button
                        key={i}
                        onClick={() => sendQuestion(q)}
                        className="rounded-full border px-3 py-1 text-xs transition hover:bg-background"
                      >
                        {q}
                      </button>

                    ))}

                  </div>

                )}

              </div>

            </div>

          ))}

          <div ref={bottomRef} />

        </div>
                {/* Input */}

        <div className="border-t p-4">

          <form
            onSubmit={handleSubmit}
            className="flex gap-3"
          >

            <Input
              value={input}
              onChange={(e) =>
                setInput(e.target.value)
              }
              placeholder="Ask a question..."
              disabled={loading}
            />

            <Button
              type="submit"
              disabled={
                loading || !input.trim()
              }
            >
              {loading
                ? "Thinking..."
                : "Send"}
            </Button>

          </form>

        </div>

      </main>

    </div>

  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1">

      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />

      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />

      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />

    </div>
  );
}