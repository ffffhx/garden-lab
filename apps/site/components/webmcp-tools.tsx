"use client";

import { useEffect } from "react";

import {
  extractPostSlugFromPathname,
  getAgentPostBySlug,
  listRecentAgentPosts,
  searchAgentPosts,
  type AgentPostSummary,
} from "@/lib/content/agent-tools";

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

type WebMcpToolsProps = {
  posts: AgentPostSummary[];
};

const categorySchema = {
  type: "string",
  enum: ["tech", "fitness", "dailyNews", "daily-news", "技术", "健身", "每日新闻"],
  description:
    "Optional category filter. Prefer tech, fitness, or dailyNews. Chinese labels and slugs are also accepted.",
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

  if (!slug) {
    return null;
  }

  return getAgentPostBySlug(posts, slug);
}

function createTools(posts: AgentPostSummary[]): WebMcpTool[] {
  return [
    {
      name: "search_blog_posts",
      title: "搜索博客文章",
      description:
        "Search this blog's articles by title, excerpt, tags, and category. Use this when the user asks for posts about a topic.",
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
      title: "列出最近博客文章",
      description:
        "List the newest articles on this blog, optionally filtered by category.",
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
      title: "读取博客文章元数据",
      description:
        "Get one blog article's machine-readable metadata by slug. Use search_blog_posts first if you do not know the slug.",
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
      title: "读取当前文章上下文",
      description:
        "Return metadata and headings for the currently open article page. Use this when the user asks about the page they are viewing.",
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

export function WebMcpTools({ posts }: WebMcpToolsProps) {
  useEffect(() => {
    const modelContext = navigator.modelContext;

    if (!modelContext?.registerTool) {
      return;
    }

    const controller = new AbortController();

    for (const tool of createTools(posts)) {
      try {
        modelContext.registerTool(tool, { signal: controller.signal });
      } catch (error) {
        console.warn(`Unable to register WebMCP tool "${tool.name}".`, error);
      }
    }

    return () => {
      controller.abort();
    };
  }, [posts]);

  return null;
}
