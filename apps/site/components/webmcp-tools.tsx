"use client";

import { useEffect } from "react";

import {
  extractDailyNewsDateSlugFromPathname,
  extractPostSlugFromPathname,
  getAgentPostBySlug,
  isDailyNewsIndexPathname,
  listRecentAgentPosts,
  searchAgentPosts,
  type AgentPostSummary,
} from "@/lib/content/agent-tools";
import { withBasePath } from "@/lib/utils/site-path";

type JsonSchema = {
  type: string;
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

type WebMcpTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
};

type ModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options?: {
      signal?: AbortSignal;
    }
  ) => void;
};

declare global {
  interface Navigator {
    modelContext?: ModelContext;
  }
}

// 全站文章索引改为静态文件（构建期由 scripts/gen-agent-post-index.ts 生成），
// 只有支持 WebMCP 的浏览器/agent 用到工具时才懒加载，普通访客不下载、也不再
// 把它序列化进每页 HTML。
const AGENT_POST_INDEX_URL = withBasePath("/agent-post-index.json");

const categorySchema = {
  type: "string",
  enum: ["tech", "fitness", "dailyNews", "daily-news", "技术", "健身", "每日新闻"],
  description:
    "Optional content section filter. Prefer tech, fitness, or dailyNews. Chinese labels and slugs are also accepted.",
};

function getCurrentArticleHeadings() {
  return Array.from(document.querySelectorAll("article h2, article h3, article h4"))
    .map((heading) => {
      return {
        id: heading.id || null,
        text: heading.textContent?.trim() ?? "",
        depth: Number(heading.tagName.slice(1)),
      };
    })
    .filter((heading) => heading.text);
}

function getCurrentPost(posts: AgentPostSummary[]) {
  const slug = extractPostSlugFromPathname(window.location.pathname);

  if (slug) {
    return getAgentPostBySlug(posts, slug);
  }

  const dailyNewsDateSlug = extractDailyNewsDateSlugFromPathname(window.location.pathname);

  if (dailyNewsDateSlug) {
    return posts.find((post) => post.dailyNewsDateSlug === dailyNewsDateSlug) ?? null;
  }

  if (isDailyNewsIndexPathname(window.location.pathname)) {
    return posts.find((post) => post.categories.some((category) => category.key === "dailyNews")) ?? null;
  }

  return null;
}

function createTools(posts: AgentPostSummary[]): WebMcpTool[] {
  return [
    {
      name: "search_blog_posts",
      title: "搜索博客内容",
      description:
        "Search this blog's articles and daily news by title, excerpt, tags, and section. Use this when the user asks for site content about a topic.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "Search keywords. Chinese and English terms are supported, for example: Codex, Agent, MCP, 健身.",
          },
          category: categorySchema,
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Maximum number of posts to return. Defaults to 8.",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute: async (input) => {
        const results = searchAgentPosts(posts, input);

        return {
          query: String(input.query ?? "").trim(),
          totalResults: results.length,
          results,
        };
      },
    },
    {
      name: "list_recent_blog_posts",
      title: "列出最近博客内容",
      description:
        "List the newest content on this blog, optionally filtered by section.",
      inputSchema: {
        type: "object",
        properties: {
          category: categorySchema,
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 20,
            description: "Maximum number of posts to return. Defaults to 8.",
          },
        },
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute: async (input) => {
        const results = listRecentAgentPosts(posts, input);

        return {
          totalResults: results.length,
          results,
        };
      },
    },
    {
      name: "get_blog_post_by_slug",
      title: "读取博客内容元数据",
      description:
        "Get one blog content item's machine-readable metadata by slug. Use search_blog_posts first if you do not know the slug.",
      inputSchema: {
        type: "object",
        properties: {
          slug: {
            type: "string",
            description: "The article slug returned by search_blog_posts.",
          },
        },
        required: ["slug"],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute: async (input) => {
        const post = getAgentPostBySlug(posts, input.slug);

        return {
          found: Boolean(post),
          post,
        };
      },
    },
    {
      name: "get_current_article_context",
      title: "读取当前内容上下文",
      description:
        "Return metadata and headings for the currently open article or daily news page. Use this when the user asks about the page they are viewing.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        untrustedContentHint: true,
      },
      execute: async () => {
        const post = getCurrentPost(posts);

        return {
          isArticlePage: Boolean(post),
          pageTitle: document.title,
          url: window.location.href,
          post,
          headings: getCurrentArticleHeadings(),
        };
      },
    },
  ];
}

export function WebMcpTools() {
  useEffect(() => {
    const modelContext = navigator.modelContext;

    // 普通访客没有 modelContext：直接返回，连索引都不会去 fetch。
    if (!modelContext?.registerTool) {
      return;
    }

    const controller = new AbortController();
    let cancelled = false;

    void (async () => {
      let posts: AgentPostSummary[];
      try {
        const response = await fetch(AGENT_POST_INDEX_URL, {
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }
        posts = (await response.json()) as AgentPostSummary[];
      } catch {
        // fetch 失败或被中止：工具不注册，不影响普通浏览。
        return;
      }

      if (cancelled || !modelContext.registerTool) {
        return;
      }

      for (const tool of createTools(posts)) {
        try {
          modelContext.registerTool(tool, { signal: controller.signal });
        } catch (error) {
          console.warn(`Unable to register WebMCP tool "${tool.name}".`, error);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return null;
}
