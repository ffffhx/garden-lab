"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/post-card";
import {
  buildAgentPostIndex,
  searchAgentPosts,
} from "@/lib/content/agent-tools";
import {
  filterPostsByTitle,
  normalizeTitleSearchQuery,
} from "@/lib/content/search";
import type { PostCardSummary } from "@/lib/content/types";

type PostTitleSearchProps = {
  posts: PostCardSummary[];
};

type AgentSubmitEvent = SubmitEvent & {
  agentInvoked?: boolean;
  respondWith?: (value: unknown) => void;
};

function getQueryFromLocation() {
  if (typeof window === "undefined") {
    return "";
  }

  return new URLSearchParams(window.location.search).get("q") ?? "";
}

function syncQueryToLocation(query: string) {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const trimmedQuery = query.trim();

  if (trimmedQuery) {
    params.set("q", trimmedQuery);
  } else {
    params.delete("q");
  }

  const search = params.toString();
  const nextUrl = `${window.location.pathname}${search ? `?${search}` : ""}${
    window.location.hash
  }`;

  window.history.replaceState(null, "", nextUrl);
}

export function PostTitleSearch({ posts }: PostTitleSearchProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    setQuery(getQueryFromLocation());
  }, []);

  const normalizedQuery = normalizeTitleSearchQuery(query);
  const hasQuery = normalizedQuery.length > 0;
  const results = useMemo(() => filterPostsByTitle(posts, query), [posts, query]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextQuery = event.currentTarget.value;
    setQuery(nextQuery);
    syncQueryToLocation(nextQuery);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const submittedQuery = String(
      new FormData(event.currentTarget).get("q") ?? ""
    );
    setQuery(submittedQuery);
    syncQueryToLocation(submittedQuery);

    const nativeEvent = event.nativeEvent as AgentSubmitEvent;

    if (nativeEvent.agentInvoked && nativeEvent.respondWith) {
      const agentPosts = buildAgentPostIndex(posts);
      const agentResults = searchAgentPosts(agentPosts, {
        query: submittedQuery,
      });

      nativeEvent.respondWith({
        query: submittedQuery.trim(),
        totalResults: agentResults.length,
        results: agentResults,
      });
    }
  }

  return (
    <main className="space-y-6">
      <section className="rounded-[2rem] border border-slate-900/10 bg-white/82 p-7 shadow-[0_32px_120px_-68px_rgba(15,23,42,0.65)]">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Search</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-slate-950">
          搜索文章
        </h1>
        <form
          role="search"
          toolname="search_blog_posts_on_page"
          tooldescription="Search this blog by article keyword and return matching posts on the search page."
          toolautosubmit=""
          className="mt-6 flex w-full flex-col gap-3 sm:flex-row"
          onSubmit={handleSubmit}
        >
          <label className="sr-only" htmlFor="post-title-search">
            按标题搜索
          </label>
          <input
            id="post-title-search"
            name="q"
            type="search"
            value={query}
            onChange={handleChange}
            toolparamtitle="query"
            toolparamdescription="Keywords to search in article title, excerpt, tags, and categories."
            placeholder="输入标题关键词"
            className="min-h-12 min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-5 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-amber-500 focus:ring-4 focus:ring-amber-200/70"
          />
          <button
            type="submit"
            className="min-h-12 rounded-full bg-slate-950 px-6 text-sm font-semibold text-white transition hover:bg-amber-800 focus:outline-none focus:ring-4 focus:ring-amber-200"
          >
            搜索
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          {hasQuery ? `找到 ${results.length} 篇标题匹配的文章` : `共 ${posts.length} 篇文章`}
        </p>
      </section>

      {!hasQuery ? (
        <EmptyState title="等待关键词" description="标题匹配的文章会显示在这里。" />
      ) : results.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {results.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <EmptyState title="没有匹配的文章" description="换一个标题关键词再试。" />
      )}
    </main>
  );
}
