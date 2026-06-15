import React from "react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { PostCard } from "@/components/post-card";
import { PrivateBadge, PrivateFeatureGate } from "@/components/private-feature-access";
import { getAllCategories } from "@/lib/content/categories";
import { CATEGORY_DEFINITIONS, SITE } from "@/lib/content/config";
import { getArticlePosts } from "@/lib/content/posts";
import { STANDALONE_PROJECTS } from "@/lib/standalone-projects";

const heroVerbs = ["写作", "构建", "观察"];

function SectionHead({
  kicker,
  title,
  action,
}: {
  kicker: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 border-b-2 border-[#1a1815] pb-3">
      <div>
        <p className="font-mono-ui text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#8f2d20]">
          {kicker}
        </p>
        <h2 className="font-display mt-1.5 text-3xl tracking-tight text-[#1a1815] sm:text-[2.6rem]">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}

export default function HomePage() {
  const articlePosts = getArticlePosts();
  const categories = getAllCategories();
  // 健身改为仅自己可见：首页公开列表与分区索引都不展示健身
  const publicPosts = articlePosts.filter(
    (post) => !post.categories.includes(CATEGORY_DEFINITIONS.fitness.key)
  );
  const publicCategories = categories.filter(
    (category) => category.slug !== CATEGORY_DEFINITIONS.fitness.slug
  );
  const featuredPosts = publicPosts.slice(0, 8);
  const priorityCoverSlug = featuredPosts.find((post) => post.cover)?.slug;

  return (
    <main className="min-w-0 space-y-14">
      {/* —— 期号条 —— */}
      <div className="edition-bar">
        <span>第 01 卷 · 数字花园与实验室</span>
        <span className="hidden sm:inline">MMXXVI · 逐日增订</span>
        <span>免费取阅</span>
      </div>

      {/* —— Hero / 报头引言 —— */}
      <section className="grid gap-10 lg:grid-cols-[1.5fr_1fr] lg:gap-0">
        <div className="lg:border-r lg:border-[#1a1815]/25 lg:pr-12">
          <p className="riso-sticker mb-5">{SITE.subtitle}</p>
          <h1 className="font-display text-[2.7rem] leading-[1.08] text-[#1a1815] sm:text-6xl lg:text-[4.2rem]">
            {heroVerbs.map((verb, index) => (
              <React.Fragment key={verb}>
                <span className="riso-mark">{verb}</span>
                {index < heroVerbs.length - 1 ? "、" : "，"}
              </React.Fragment>
            ))}
            <br />
            都在这座数字花园里生长。
          </h1>
          <p className="drop-cap mt-7 max-w-2xl text-lg leading-[1.85] text-[#3c362c]">
            一座持续生长的数字花园，收录源码解析与工程实践、亲手做的项目，以及日常的技术观察。一边搭建一边修剪，让每一篇手记都留下年轮。
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-5">
            <Link
              href={`/category/${CATEGORY_DEFINITIONS.tech.slug}`}
              className="inline-flex min-h-11 items-center rounded-none border-[1.5px] border-[#1a1815] bg-[#1a1815] px-5 text-sm font-semibold !text-[#faf6ec] transition hover:bg-[#8f2d20] hover:border-[#8f2d20]"
            >
              开始阅读 →
            </Link>
          </div>
        </div>

        <div className="lg:pl-12">
          <p className="font-mono-ui border-b border-[#1a1815]/25 pb-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-[#8f2d20]">
            本卷分区 · Contents
          </p>
          <div>
            {publicCategories.map((category, index) => (
              <Link
                key={category.slug}
                href={`/category/${category.slug}`}
                className="group flex items-baseline gap-4 border-b border-[#1a1815]/15 py-4 transition hover:bg-[#1a1815]/[0.03]"
              >
                <span className="font-display w-9 shrink-0 text-2xl text-[#8f2d20]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-display block text-xl text-[#1a1815] transition group-hover:text-[#8f2d20]">
                    {category.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-[#6a6155]">
                    {category.description}
                  </span>
                </span>
                <span className="tabular shrink-0 text-xs text-[#6a6155]">
                  {category.posts.length} 篇
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* —— 独立项目 —— */}
      <section className="space-y-7">
        <SectionHead
          kicker="Standalone Projects"
          title="已独立维护的项目"
          action={
            <p className="hidden max-w-xs text-xs leading-6 text-[#6a6155] sm:block sm:text-right">
              独立维护的小项目都放在这里，保留简短索引和公开地址。
            </p>
          }
        />
        <div className="grid min-w-0 gap-x-6 gap-y-7 sm:grid-cols-2 xl:grid-cols-4">
          {STANDALONE_PROJECTS.map((project, index) => {
            const card = (
              <article className="riso-card group flex min-h-[16rem] flex-col p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-mono-ui text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-[#8f2d20]">
                    {String(index + 1).padStart(2, "0")} · {project.badge}
                  </span>
                  {project.private ? <PrivateBadge withText /> : null}
                </div>
                <h3 className="font-display mt-4 text-2xl leading-tight text-[#1a1815]">
                  {project.title}
                </h3>
                <p className="font-mono-ui mt-1 text-[0.7rem] uppercase tracking-[0.08em] text-[#6a6155]">
                  {project.productName}
                </p>
                <p className="mt-3 text-[0.95rem] leading-7 text-[#3c362c]">{project.description}</p>
                <div className="mt-auto pt-5">
                  <p className="break-all font-mono text-[0.7rem] text-[#6a6155]">
                    {project.displayUrl}
                  </p>
                  <a
                    href={project.href}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono-ui mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#1a1815] transition hover:gap-2.5 hover:text-[#8f2d20]"
                  >
                    打开网站 →
                  </a>
                </div>
              </article>
            );

            return project.private ? (
              <PrivateFeatureGate key={project.slug}>{card}</PrivateFeatureGate>
            ) : (
              <React.Fragment key={project.slug}>{card}</React.Fragment>
            );
          })}
        </div>
      </section>

      {/* —— 最新文章 —— */}
      <section className="space-y-7">
        <SectionHead kicker="Latest Writing" title="最新文章" />
        {featuredPosts.length > 0 ? (
          <div className="grid min-w-0 gap-x-6 gap-y-8 lg:grid-cols-2">
            {featuredPosts.map((post, index) => (
              <PostCard
                key={post.slug}
                featured={index === 0}
                post={post}
                priority={post.slug === priorityCoverSlug}
              />
            ))}
          </div>
        ) : (
          <EmptyState title="还没有文章" description="内容会在这里出现。" />
        )}
      </section>
    </main>
  );
}
