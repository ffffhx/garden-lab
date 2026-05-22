"use client";

import {
  type MouseEvent,
  type ReactNode,
  type TouchEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type SelectionExplanation = {
  term: string;
  meaning: string;
  context: string;
  extra: string;
  sources: Array<{
    title: string;
    url: string;
  }>;
};

type TooltipStatus = "loading" | "ready" | "error";

type TooltipState = {
  context: string;
  error?: string;
  explanation?: SelectionExplanation;
  key: string;
  left: number;
  placement: "top" | "bottom";
  selectedText: string;
  status: TooltipStatus;
  top: number;
};

type ArticleSelectionTooltipProps = {
  children: ReactNode;
  slug: string;
  title: string;
};

const MAX_SELECTION_CHARS = 80;
const TOOLTIP_WIDTH = 368;
const TOOLTIP_VERTICAL_SPACE = 224;

function getSelectionExplainEndpoint() {
  const configured = process.env.NEXT_PUBLIC_SELECTION_EXPLAIN_API_URL?.trim();

  if (configured) {
    const endpoint = configured.replace(/\/+$/, "");

    if (
      endpoint.endsWith("/explain-selection") ||
      endpoint.endsWith("/api/explain-selection")
    ) {
      return endpoint;
    }

    return `${endpoint}/explain-selection`;
  }

  const tokenBoardApi = process.env.NEXT_PUBLIC_TOKEN_BOARD_API_URL?.trim();

  if (!tokenBoardApi) {
    return "";
  }

  return `${tokenBoardApi.replace(/\/+$/, "")}/api/explain-selection`;
}

function normalizeSelectedText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isNodeInside(container: HTMLElement, node: Node) {
  return container === node || container.contains(node);
}

function getSelectionRect(range: Range) {
  const rect = range.getBoundingClientRect();

  if (rect.width > 0 || rect.height > 0) {
    return rect;
  }

  return Array.from(range.getClientRects()).find((item) => {
    return item.width > 0 || item.height > 0;
  }) ?? null;
}

function getBlockContext(range: Range, container: HTMLElement) {
  const node =
    range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;

  const element = node instanceof Element ? node : null;
  const block = element?.closest(
    "p,li,h1,h2,h3,h4,h5,h6,blockquote,td,th"
  );
  const text = block && container.contains(block)
    ? block.textContent
    : range.commonAncestorContainer.textContent;

  return normalizeSelectedText(text ?? "").slice(0, 1200);
}

function buildTooltipPosition(rect: DOMRect) {
  const viewportWidth = window.innerWidth;
  const left = clamp(
    rect.left + rect.width / 2 - TOOLTIP_WIDTH / 2,
    8,
    Math.max(8, viewportWidth - TOOLTIP_WIDTH - 8)
  );
  const hasRoomAbove = rect.top > TOOLTIP_VERTICAL_SPACE;

  return {
    left,
    placement: hasRoomAbove ? ("top" as const) : ("bottom" as const),
    top: hasRoomAbove ? rect.top - 12 : rect.bottom + 12,
  };
}

export function ArticleSelectionTooltip({
  children,
  slug,
  title,
}: ArticleSelectionTooltipProps) {
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, SelectionExplanation>());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const latestKeyRef = useRef("");
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const closeTooltip = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    latestKeyRef.current = "";
    setTooltip(null);
  }, []);

  const explainSelection = useCallback(
    async (nextTooltip: TooltipState) => {
      const cached = cacheRef.current.get(nextTooltip.key);

      if (cached) {
        setTooltip({ ...nextTooltip, explanation: cached, status: "ready" });
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const endpoint = getSelectionExplainEndpoint();

        if (!endpoint) {
          throw new Error(
            "缺少 AI 解释服务地址，暂时不能请求 Kimi 解释。"
          );
        }

        const response = await fetch(endpoint, {
          body: JSON.stringify({
            context: nextTooltip.context,
            selection: nextTooltip.selectedText,
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
          throw new Error(
            payload?.error || "AI 解释暂时不可用，请稍后再试。"
          );
        }

        const explanation = payload?.explanation as SelectionExplanation | undefined;

        if (!explanation) {
          throw new Error("AI 返回内容为空，请重新选中试一次。");
        }

        cacheRef.current.set(nextTooltip.key, explanation);

        if (latestKeyRef.current === nextTooltip.key) {
          setTooltip({
            ...nextTooltip,
            explanation,
            status: "ready",
          });
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        if (latestKeyRef.current === nextTooltip.key) {
          setTooltip({
            ...nextTooltip,
            error:
              error instanceof Error
                ? error.message
                : "AI 解释暂时不可用，请稍后再试。",
            status: "error",
          });
        }
      }
    },
    [slug, title]
  );

  const captureSelection = useCallback(
    (event?: Event) => {
      if (
        event?.target instanceof Node &&
        tooltipRef.current?.contains(event.target)
      ) {
        return;
      }

      const container = containerRef.current;
      const selection = window.getSelection();

      if (!container || !selection || selection.isCollapsed || selection.rangeCount === 0) {
        closeTooltip();
        return;
      }

      const range = selection.getRangeAt(0);

      if (
        !isNodeInside(container, range.startContainer) ||
        !isNodeInside(container, range.endContainer)
      ) {
        closeTooltip();
        return;
      }

      const selectedText = normalizeSelectedText(selection.toString());

      if (
        selectedText.length < 2 ||
        selectedText.length > MAX_SELECTION_CHARS
      ) {
        closeTooltip();
        return;
      }

      const rect = getSelectionRect(range);

      if (!rect) {
        closeTooltip();
        return;
      }

      const context = getBlockContext(range, container);
      const key = `${slug}\n${selectedText}\n${context}`;
      const position = buildTooltipPosition(rect);
      const nextTooltip: TooltipState = {
        context,
        key,
        selectedText,
        status: "loading",
        ...position,
      };

      latestKeyRef.current = key;
      setTooltip(nextTooltip);
      void explainSelection(nextTooltip);
    },
    [closeTooltip, explainSelection, slug]
  );

  useEffect(() => {
    const handleSelectionComplete = (event: Event) => {
      window.setTimeout(() => captureSelection(event), 0);
    };
    const handleScrollOrResize = (event: Event) => {
      if (
        event.type === "scroll" &&
        event.target instanceof Node &&
        tooltipRef.current?.contains(event.target)
      ) {
        return;
      }

      closeTooltip();
    };

    document.addEventListener("mouseup", handleSelectionComplete);
    document.addEventListener("keyup", handleSelectionComplete);
    document.addEventListener("touchend", handleSelectionComplete);
    window.addEventListener("resize", handleScrollOrResize);
    window.addEventListener("scroll", handleScrollOrResize, true);

    return () => {
      abortRef.current?.abort();
      document.removeEventListener("mouseup", handleSelectionComplete);
      document.removeEventListener("keyup", handleSelectionComplete);
      document.removeEventListener("touchend", handleSelectionComplete);
      window.removeEventListener("resize", handleScrollOrResize);
      window.removeEventListener("scroll", handleScrollOrResize, true);
    };
  }, [captureSelection, closeTooltip]);

  const retry = (event: MouseEvent<HTMLButtonElement> | TouchEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (!tooltip) {
      return;
    }

    const nextTooltip = {
      ...tooltip,
      error: undefined,
      explanation: undefined,
      status: "loading" as const,
    };

    latestKeyRef.current = nextTooltip.key;
    setTooltip(nextTooltip);
    void explainSelection(nextTooltip);
  };

  return (
    <div className="article-selection-layer" ref={containerRef}>
      {children}
      {tooltip ? (
        <div
          aria-live="polite"
          className="article-ai-tooltip"
          data-placement={tooltip.placement}
          ref={tooltipRef}
          role="status"
          style={{
            left: tooltip.left,
            top: tooltip.top,
          }}
        >
          <div className="article-ai-tooltip__header">
            <div className="min-w-0">
              <p className="article-ai-tooltip__eyebrow">Kimi 搜索</p>
              <p className="article-ai-tooltip__term" title={tooltip.selectedText}>
                {tooltip.selectedText}
              </p>
            </div>
            <button
              aria-label="关闭解释"
              className="article-ai-tooltip__icon-button"
              onClick={closeTooltip}
              type="button"
            >
              ×
            </button>
          </div>

          {tooltip.status === "loading" ? (
            <div className="article-ai-tooltip__loading">
              <span className="article-ai-tooltip__pulse" />
              <span>正在查资料并结合上下文解释</span>
            </div>
          ) : null}

          {tooltip.status === "error" ? (
            <div className="article-ai-tooltip__error">
              <p>{tooltip.error}</p>
              <button
                className="article-ai-tooltip__retry"
                onClick={retry}
                type="button"
              >
                重试
              </button>
            </div>
          ) : null}

          {tooltip.status === "ready" && tooltip.explanation ? (
            <div className="article-ai-tooltip__body">
              <section>
                <h2>词义</h2>
                <p>{tooltip.explanation.meaning}</p>
              </section>
              <section>
                <h2>在文中</h2>
                <p>{tooltip.explanation.context}</p>
              </section>
              {tooltip.explanation.extra ? (
                <section>
                  <h2>延伸</h2>
                  <p>{tooltip.explanation.extra}</p>
                </section>
              ) : null}
              {tooltip.explanation.sources.length ? (
                <section>
                  <h2>来源</h2>
                  <div className="article-ai-tooltip__sources">
                    {tooltip.explanation.sources.map((source) => (
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
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
