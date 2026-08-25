"use client";

import React, {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  ARTICLE_AI_CHAT_OPEN_EVENT,
  type ArticleAiChatOpenDetail,
} from "@/components/article-ai-chat-events";
import { PrivateBadge } from "@/components/private-feature-access";
import type { Heading } from "@/lib/content/types";

type ChatRole = "assistant" | "user";

type ChatSource = {
  title: string;
  url: string;
};

type ChatMessage = {
  content: string;
  id: string;
  role: ChatRole;
  sources?: ChatSource[];
};

type ArticleFocus = {
  context: string;
  selection: string;
};

type ArticleAiChatProps = {
  articleContentId: string;
  excerpt: string;
  headings: Heading[];
  slug: string;
  title: string;
};

const ARTICLE_CONTEXT_MAX_CHARS = 24_000;
const CHAT_HISTORY_MAX_MESSAGES = 8;
const QUESTION_MAX_CHARS = 1_000;
const QUICK_PROMPTS = [
  "补全这篇文章的背景",
  "展开一个文章没细讲的细节",
  "列 3 个值得继续追问的问题",
];

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function getArticleChatEndpoint() {
  const configured = process.env.NEXT_PUBLIC_ARTICLE_CHAT_API_URL?.trim();

  if (configured) {
    const endpoint = stripTrailingSlash(configured);

    if (
      endpoint.endsWith("/chat-article") ||
      endpoint.endsWith("/api/chat-article")
    ) {
      return endpoint;
    }

    return `${endpoint}/chat-article`;
  }

  const selectionEndpoint =
    process.env.NEXT_PUBLIC_SELECTION_EXPLAIN_API_URL?.trim();

  if (selectionEndpoint) {
    const endpoint = stripTrailingSlash(selectionEndpoint);

    if (endpoint.endsWith("/api/explain-selection")) {
      return endpoint.replace(/\/api\/explain-selection$/, "/api/chat-article");
    }

    if (endpoint.endsWith("/explain-selection")) {
      return endpoint.replace(/\/explain-selection$/, "/chat-article");
    }

    return `${endpoint}/chat-article`;
  }

  const gardenApi = process.env.NEXT_PUBLIC_GARDEN_API_URL?.trim();
  const tokenBoardApi = process.env.NEXT_PUBLIC_TOKEN_BOARD_API_URL?.trim();
  const fallbackBase = gardenApi || tokenBoardApi;

  if (!fallbackBase) {
    return "";
  }

  return `${stripTrailingSlash(fallbackBase)}/api/chat-article`;
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function trimArticleContext(text: string) {
  const normalized = normalizeText(text);

  if (normalized.length <= ARTICLE_CONTEXT_MAX_CHARS) {
    return normalized;
  }

  const head = normalized.slice(0, 17_000).trim();
  const tail = normalized.slice(-6_000).trim();

  return `${head}\n\n[中间部分已截断]\n\n${tail}`;
}

function createMessageId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function createInitialMessages(): ChatMessage[] {
  return [
    {
      content: "我在读这篇文章。想先从哪里开始？",
      id: "assistant-intro",
      role: "assistant",
    },
  ];
}

function getString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseSources(input: unknown): ChatSource[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const source = item as Record<string, unknown>;
      const title = getString(source.title) || getString(source.name);
      const url = getString(source.url) || getString(source.href);

      if (!url) {
        return null;
      }

      return {
        title: title || url,
        url,
      };
    })
    .filter((item): item is ChatSource => Boolean(item))
    .slice(0, 5);
}

function parseAnswer(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const direct =
    getString(record.answer) ||
    getString(record.message) ||
    getString(record.content);

  if (direct) {
    return direct;
  }

  const nested = record.response;

  if (nested && typeof nested === "object") {
    const response = nested as Record<string, unknown>;
    return getString(response.answer) || getString(response.content);
  }

  return "";
}

function buildSelectionPrompt(selection: string) {
  return `关于「${selection}」，文中这段上下文背后还有什么需要知道？`;
}

export function ArticleAiChat({
  articleContentId,
  excerpt,
  headings,
  slug,
  title,
}: ArticleAiChatProps) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(createInitialMessages);
  const [pendingFocus, setPendingFocus] = useState<ArticleFocus | null>(null);
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const getArticleText = useCallback(() => {
    const article = document.getElementById(articleContentId);
    const text = article?.textContent || "";

    return trimArticleContext(text || excerpt);
  }, [articleContentId, excerpt]);

  const resetChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setDraft("");
    setError("");
    setMessages(createInitialMessages());
    setPendingFocus(null);
    setStatus("idle");
  };

  const sendQuestion = useCallback(
    async (question: string) => {
      const normalizedQuestion = question.trim();

      if (!normalizedQuestion || status === "loading") {
        return;
      }

      const endpoint = getArticleChatEndpoint();
      const userMessage: ChatMessage = {
        content: normalizedQuestion,
        id: createMessageId("user"),
        role: "user",
      };
      const pendingMessage: ChatMessage = {
        content: "正在整理文章上下文",
        id: createMessageId("assistant-loading"),
        role: "assistant",
      };
      const focus = pendingFocus;
      const nextMessages = [...messages, userMessage];

      setDraft("");
      setError("");
      setIsOpen(true);
      setPendingFocus(null);
      setStatus("loading");
      setMessages([...nextMessages, pendingMessage]);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        if (!endpoint) {
          throw new Error("缺少 AI 聊天服务地址，暂时不能请求 Kimi。");
        }

        const response = await fetch(endpoint, {
          body: JSON.stringify({
            articleText: getArticleText(),
            excerpt,
            focus,
            headings: headings.map((heading) => ({
              depth: heading.depth,
              text: heading.text,
            })),
            messages: nextMessages.slice(-CHAT_HISTORY_MAX_MESSAGES).map((message) => ({
              content: message.content,
              role: message.role,
            })),
            slug,
            title,
          }),
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(payload?.error || "AI 问答暂时不可用，请稍后再试。");
        }

        const answer = parseAnswer(payload);

        if (!answer) {
          throw new Error("AI 返回内容为空，请换个问法再试。");
        }

        setMessages((current) => {
          return current.map((message) => {
            if (message.id !== pendingMessage.id) {
              return message;
            }

            return {
              content: answer,
              id: createMessageId("assistant"),
              role: "assistant",
              sources: parseSources(payload?.sources),
            };
          });
        });
        setStatus("idle");
      } catch (requestError) {
        if (controller.signal.aborted) {
          return;
        }

        setMessages((current) => {
          return current.filter((message) => message.id !== pendingMessage.id);
        });
        setError(
          requestError instanceof Error
            ? requestError.message
            : "AI 问答暂时不可用，请稍后再试。"
        );
        setStatus("idle");
      }
    },
    [
      excerpt,
      getArticleText,
      headings,
      messages,
      pendingFocus,
      slug,
      status,
      title,
    ]
  );

  const submitDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendQuestion(draft);
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendQuestion(draft);
    }
  };

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail =
        event instanceof CustomEvent
          ? (event.detail as ArticleAiChatOpenDetail | undefined)
          : undefined;

      if (!detail || (detail.slug && detail.slug !== slug)) {
        return;
      }

      const selection = getString(detail.selection);
      const context = getString(detail.context);
      const prompt = getString(detail.prompt);

      setIsOpen(true);

      if (selection) {
        setPendingFocus({ context, selection });
      }

      setDraft((current) => {
        if (current.trim()) {
          return current;
        }

        return prompt || (selection ? buildSelectionPrompt(selection) : current);
      });

      window.setTimeout(() => textareaRef.current?.focus(), 60);
    };

    window.addEventListener(ARTICLE_AI_CHAT_OPEN_EVENT, handleOpen);

    return () => {
      window.removeEventListener(ARTICLE_AI_CHAT_OPEN_EVENT, handleOpen);
    };
  }, [slug]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [isOpen, messages]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const canSubmit = Boolean(draft.trim()) && status !== "loading";

  return (
    <>
      <button
        aria-expanded={isOpen}
        aria-label="打开文章问答"
        className={`article-ai-chat__launcher${
          isOpen ? " article-ai-chat__launcher--hidden" : ""
        }`}
        onClick={() => setIsOpen(true)}
        title="打开文章问答"
        type="button"
      >
        <span className="article-ai-chat__launcher-mark">AI</span>
        <span>问文章</span>
        <PrivateBadge className="border-none bg-transparent px-0 py-0 text-current" />
      </button>

      <aside
        aria-label="文章问答"
        className={`article-ai-chat${isOpen ? " article-ai-chat--open" : ""}`}
      >
        <div className="article-ai-chat__header">
          <div className="min-w-0">
            <p className="article-ai-chat__eyebrow">Kimi context</p>
            <h2>文章问答</h2>
          </div>
          <div className="article-ai-chat__controls">
            <button
              aria-label="清空对话"
              className="article-ai-chat__icon-button"
              onClick={resetChat}
              title="清空对话"
              type="button"
            >
              ↺
            </button>
            <button
              aria-label="收起问答"
              className="article-ai-chat__icon-button"
              onClick={() => setIsOpen(false)}
              title="收起问答"
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        <div className="article-ai-chat__messages">
          {messages.map((message) => (
            <div
              className="article-ai-chat__message"
              data-role={message.role}
              key={message.id}
            >
              <p>{message.content}</p>
              {message.sources?.length ? (
                <div className="article-ai-chat__sources">
                  {message.sources.map((source) => (
                    <a
                      href={source.url}
                      key={source.url}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {source.title}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="article-ai-chat__quick-actions">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              disabled={status === "loading"}
              key={prompt}
              onClick={() => void sendQuestion(prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>

        {pendingFocus ? (
          <p className="article-ai-chat__focus">已带入：{pendingFocus.selection}</p>
        ) : null}

        {error ? (
          <p className="article-ai-chat__error" role="alert">
            {error}
          </p>
        ) : null}

        <form className="article-ai-chat__composer" onSubmit={submitDraft}>
          <textarea
            maxLength={QUESTION_MAX_CHARS}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleDraftKeyDown}
            placeholder="问一个跟这篇文章有关的问题"
            ref={textareaRef}
            rows={3}
            value={draft}
          />
          <button disabled={!canSubmit} type="submit">
            {status === "loading" ? "等待" : "发送"}
          </button>
        </form>
      </aside>
    </>
  );
}
