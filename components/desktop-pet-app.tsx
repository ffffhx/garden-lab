"use client";

import type { PointerEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  BLOG_PET_SNAPSHOT_PUBLIC_PATH,
  type BlogPetSnapshot,
  type BlogPetStats,
} from "@/lib/content/blog-pet";
import { withBasePath } from "@/lib/utils/site-path";

type DesktopPetIconName = "close" | "external" | "minus" | "moon" | "pause" | "play" | "refresh";
type DesktopPetReaction = "nod" | "stretch";

const DOCUMENT_CLASS_NAME = "desktop-pet-document";
const DRAG_THRESHOLD = 5;
const LOCAL_SNAPSHOT_POLL_MS = 15_000;

type DesktopDragState = {
  startX: number;
  startY: number;
  started: boolean;
};

function DesktopPetIcon({ name }: { name: DesktopPetIconName }) {
  const sharedProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.1,
  };

  return (
    <svg className="desktop-pet__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {name === "close" ? (
        <>
          <path {...sharedProps} d="M6 6l12 12" />
          <path {...sharedProps} d="M18 6L6 18" />
        </>
      ) : null}
      {name === "external" ? (
        <>
          <path {...sharedProps} d="M14 5h5v5" />
          <path {...sharedProps} d="M10 14 19 5" />
          <path {...sharedProps} d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4" />
        </>
      ) : null}
      {name === "minus" ? <path {...sharedProps} d="M5 12h14" /> : null}
      {name === "moon" ? (
        <path
          {...sharedProps}
          d="M20 14.7A7.5 7.5 0 0 1 9.3 4a6.5 6.5 0 1 0 10.7 10.7Z"
        />
      ) : null}
      {name === "pause" ? (
        <>
          <path {...sharedProps} d="M8 5v14" />
          <path {...sharedProps} d="M16 5v14" />
        </>
      ) : null}
      {name === "play" ? <path {...sharedProps} fill="currentColor" d="M8 5v14l11-7Z" /> : null}
      {name === "refresh" ? (
        <>
          <path {...sharedProps} d="M20 11a8 8 0 0 0-14.7-4.4L4 8" />
          <path {...sharedProps} d="M4 4v4h4" />
          <path {...sharedProps} d="M4 13a8 8 0 0 0 14.7 4.4L20 16" />
          <path {...sharedProps} d="M16 16h4v4" />
        </>
      ) : null}
    </svg>
  );
}

async function getDesktopWindow() {
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");

    return getCurrentWindow();
  } catch {
    return null;
  }
}

function getExternalBlogUrl() {
  const explicitUrl = process.env.NEXT_PUBLIC_DESKTOP_PET_BLOG_URL?.trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  if (typeof window !== "undefined" && window.location.protocol.startsWith("http")) {
    return new URL(withBasePath("/pet/"), window.location.origin).toString();
  }

  return null;
}

function desktopClickLine(stats: BlogPetStats) {
  if (stats.dominantAttribute.id === "intelligence") {
    return "今天适合嚼一点代码脆片。";
  }

  if (stats.dominantAttribute.id === "stamina") {
    return "训练记录的味道很顶，我精神了。";
  }

  if (stats.dominantAttribute.id === "speed") {
    return "热点糖粒在响，我准备巡逻。";
  }

  return "我在桌面待命，等下一篇文章投喂。";
}

function hasPetSnapshot(value: unknown): value is BlogPetSnapshot {
  return Boolean(value && typeof value === "object" && "pet" in value);
}

async function readLocalPetSnapshot() {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const rawSnapshot = await invoke<string>("read_local_pet_snapshot");
    const snapshot = JSON.parse(rawSnapshot) as unknown;

    return hasPetSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

async function fetchBundledPetSnapshot() {
  try {
    const response = await fetch(withBasePath(BLOG_PET_SNAPSHOT_PUBLIC_PATH), {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const snapshot = (await response.json()) as unknown;

    return hasPetSnapshot(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

export function DesktopPetApp() {
  const dragRef = useRef<DesktopDragState | null>(null);
  const suppressClickRef = useRef(false);
  const [stats, setStats] = useState<BlogPetStats | null>(null);
  const [paused, setPaused] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [reaction, setReaction] = useState<DesktopPetReaction | null>(null);
  const [speech, setSpeech] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const blogUrl = useMemo(getExternalBlogUrl, []);

  useEffect(() => {
    document.documentElement.classList.add(DOCUMENT_CLASS_NAME);
    document.title = "Blog Pet";

    return () => {
      document.documentElement.classList.remove(DOCUMENT_CLASS_NAME);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function loadPetStats() {
      const snapshot = (await readLocalPetSnapshot()) ?? (await fetchBundledPetSnapshot());

      if (!cancelled && snapshot?.pet) {
        setStats(snapshot.pet);
      }
    }

    loadPetStats();
    timer = window.setInterval(loadPetStats, LOCAL_SNAPSHOT_POLL_MS);

    return () => {
      cancelled = true;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!stats || speech) {
      return;
    }

    setSpeech(`${stats.stage.name}在桌面待命，Lv.${stats.level}。`);
  }, [speech, stats]);

  useEffect(() => {
    if (!speech) {
      return undefined;
    }

    const timer = window.setTimeout(() => setSpeech(""), 4400);

    return () => window.clearTimeout(timer);
  }, [speech]);

  useEffect(() => {
    if (!reaction) {
      return undefined;
    }

    const timer = window.setTimeout(() => setReaction(null), 900);

    return () => window.clearTimeout(timer);
  }, [reaction]);

  const currentFood = stats?.latestMeal?.foods[0] ?? stats?.favoriteFood;
  const stageFormLevel = stats
    ? (stats.stage.formLevel ?? Math.min(10, Math.ceil(stats.level / 5)))
    : 1;
  const stagePhase = stats ? (stats.stage.phase ?? (((stats.level - 1) % 5) + 1)) : 1;
  const rootClassName = [
    "blog-pet",
    "blog-pet--desktop",
    stats ? `blog-pet--level-${stats.level}` : "",
    `blog-pet--form-${stageFormLevel}`,
    `blog-pet--phase-${stagePhase}`,
    stats ? `blog-pet--${stats.hunger.tone}` : "",
    stats ? `blog-pet--attr-${stats.dominantAttribute.id}` : "",
    stats ? `blog-pet--evolution-${stats.evolution.id}` : "",
    paused ? "blog-pet--paused" : "",
    sleeping ? "blog-pet--sleeping" : "",
    dragging ? "blog-pet--dragging" : "",
    reaction ? `blog-pet--react-${reaction}` : "",
  ]
    .filter(Boolean)
    .join(" ");

  async function startWindowDrag() {
    const appWindow = await getDesktopWindow();

    if (!appWindow) {
      return;
    }

    await appWindow.startDragging();
  }

  function wake() {
    setSleeping(false);
  }

  function handlePointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      started: false,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;

    if (!drag || drag.started) {
      return;
    }

    const moved =
      Math.abs(event.clientX - drag.startX) > DRAG_THRESHOLD ||
      Math.abs(event.clientY - drag.startY) > DRAG_THRESHOLD;

    if (!moved) {
      return;
    }

    drag.started = true;
    suppressClickRef.current = true;
    setDragging(true);
    setSpeech("");
    startWindowDrag().catch(() => {
      setDragging(false);
    });
  }

  function handlePointerUp() {
    dragRef.current = null;
    setDragging(false);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function handleSpriteClick() {
    if (!stats || suppressClickRef.current) {
      return;
    }

    wake();
    setReaction(stats.dominantAttribute.id === "stamina" ? "stretch" : "nod");
    setSpeech(desktopClickLine(stats));
  }

  function handleSleep() {
    setSleeping(true);
    setSpeech("我先蜷起来睡一会儿。");
  }

  function handlePauseToggle() {
    setPaused((value) => !value);
  }

  function handleRefresh() {
    wake();
    setRefreshKey((value) => value + 1);
    setSpeech("同步了一下博客投喂状态。");
  }

  async function handleMinimize() {
    const appWindow = await getDesktopWindow();

    await appWindow?.minimize();
  }

  async function handleClose() {
    const appWindow = await getDesktopWindow();

    await appWindow?.close();
  }

  async function handleOpenBlog() {
    if (!blogUrl) {
      return;
    }

    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");

      await openUrl(blogUrl);
    } catch {
      window.open(blogUrl, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <main className="desktop-pet-shell" aria-label="博客桌面宠物">
      <section className={rootClassName} aria-live="polite" onMouseEnter={wake}>
        {speech ? <div className="desktop-pet__bubble">{speech}</div> : null}

        <div className="desktop-pet__actions" aria-label="桌宠窗口操作">
          <button type="button" onClick={handleRefresh} aria-label="刷新桌宠状态" title="刷新">
            <DesktopPetIcon name="refresh" />
          </button>
          <button
            type="button"
            onClick={handleSleep}
            aria-label="让桌宠睡觉"
            title="睡觉"
          >
            <DesktopPetIcon name="moon" />
          </button>
          <button
            type="button"
            onClick={handlePauseToggle}
            aria-label={paused ? "继续桌宠动画" : "暂停桌宠动画"}
            title={paused ? "继续动画" : "暂停动画"}
          >
            <DesktopPetIcon name={paused ? "play" : "pause"} />
          </button>
          {blogUrl ? (
            <button type="button" onClick={handleOpenBlog} aria-label="打开博客宠物档案" title="档案">
              <DesktopPetIcon name="external" />
            </button>
          ) : null}
          <button type="button" onClick={handleMinimize} aria-label="最小化桌宠" title="最小化">
            <DesktopPetIcon name="minus" />
          </button>
          <button type="button" onClick={handleClose} aria-label="关闭桌宠" title="关闭">
            <DesktopPetIcon name="close" />
          </button>
        </div>

        <button
          className="blog-pet__sprite-button"
          type="button"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleSpriteClick}
          aria-label="和博客桌面宠物互动，拖动可以移动窗口"
          title="点击互动，拖动移动"
        >
          <span className="blog-pet__aura" aria-hidden="true" />
          <span className="blog-pet__sprite" aria-hidden="true">
            <span className="blog-pet__tail" />
            <span className="blog-pet__cape" />
            <span className="blog-pet__leg blog-pet__leg--left" />
            <span className="blog-pet__leg blog-pet__leg--right" />
            <span className="blog-pet__arm blog-pet__arm--left" />
            <span className="blog-pet__arm blog-pet__arm--right" />
            <span className="blog-pet__ear blog-pet__ear--left" />
            <span className="blog-pet__ear blog-pet__ear--right" />
            <span className="blog-pet__horn blog-pet__horn--left" />
            <span className="blog-pet__horn blog-pet__horn--right" />
            <span className="blog-pet__wing blog-pet__wing--left" />
            <span className="blog-pet__wing blog-pet__wing--right" />
            <span className="blog-pet__mane" />
            <span className="blog-pet__crest" />
            <span className="blog-pet__scarf" />
            <span className="blog-pet__mask" />
            <span className="blog-pet__glasses" />
            <span className="blog-pet__book" />
            <span className="blog-pet__artifact" />
            <span className="blog-pet__weapon" />
            <span className="blog-pet__face">
              <span className="blog-pet__eye blog-pet__eye--left" />
              <span className="blog-pet__eye blog-pet__eye--right" />
              <span className="blog-pet__mouth" />
            </span>
            <span className="blog-pet__belly" />
            <span className="blog-pet__paw blog-pet__paw--left" />
            <span className="blog-pet__paw blog-pet__paw--right" />
          </span>
          {currentFood ? (
            <span className="blog-pet__food-chip" aria-hidden="true">
              {currentFood.shortLabel}
            </span>
          ) : null}
        </button>

        <div className="desktop-pet__status" aria-label="桌宠状态">
          <span>{stats?.stage.name ?? "Blog Pet"}</span>
          <strong>Lv.{stats?.level ?? "-"}</strong>
          <em>{stats?.hunger.label ?? "同步中"}</em>
        </div>
      </section>
    </main>
  );
}
