"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BLOG_PET_SNAPSHOT_PUBLIC_PATH,
  type BlogPetSnapshot,
  type BlogPetStats,
} from "@/lib/content/blog-pet";
import { withBasePath } from "@/lib/utils/site-path";

type PetPosition = {
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  moved: boolean;
};

type Reaction = "nod" | "stretch";
type ArticleProgressMilestoneName = "half" | "done" | "top";
type ArticleProgressMilestones = {
  half: boolean;
  done: boolean;
  leftTop: boolean;
  returnedTop: boolean;
};
type QuickActionIconName = "hide" | "pause" | "play" | "sleep" | "top";
type PanelPositionStyle = CSSProperties & {
  "--pet-panel-left"?: string;
  "--pet-panel-top"?: string;
  "--pet-panel-width"?: string;
  "--pet-panel-max-height"?: string;
};

const LAST_SEEN_XP_KEY = "blog-pet:last-seen-xp";
const POSITION_KEY = "blog-pet:position-v1";
const PAUSED_KEY = "blog-pet:paused";
const HIDDEN_KEY = "blog-pet:hidden";
const LEGACY_COMPACT_KEY = "blog-pet:compact";
const DRAG_HINT_KEY = "blog-pet:drag-hint-seen";
const IDLE_MS = 45_000;
const COMPACT_LAYOUT_QUERY = "(max-width: 768px)";

const ARTICLE_PROGRESS_DEFAULTS: ArticleProgressMilestones = {
  half: false,
  done: false,
  leftTop: false,
  returnedTop: false,
};

function QuickActionIcon({ name }: { name: QuickActionIconName }) {
  const sharedProps = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.2,
  };

  return (
    <svg
      className="blog-pet__quick-icon"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {name === "hide" ? <path {...sharedProps} d="M5 12h14" /> : null}
      {name === "sleep" ? (
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
      {name === "top" ? (
        <>
          <path {...sharedProps} d="m12 5-6 6" />
          <path {...sharedProps} d="m12 5 6 6" />
          <path {...sharedProps} d="M12 5v14" />
        </>
      ) : null}
    </svg>
  );
}

function meterStyle(ratio: number) {
  return {
    "--meter-value": `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`,
  } as CSSProperties;
}

function readBoolean(key: string) {
  try {
    return window.localStorage.getItem(key) === "true";
  } catch {
    return false;
  }
}

function writeBoolean(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch {
    // Local UI preferences are optional.
  }
}

function readPosition() {
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PetPosition>) : null;

    if (
      parsed &&
      Number.isFinite(parsed.x) &&
      Number.isFinite(parsed.y) &&
      typeof parsed.x === "number" &&
      typeof parsed.y === "number"
    ) {
      return parsed as PetPosition;
    }
  } catch {
    return null;
  }

  return null;
}

function writePosition(position: PetPosition) {
  try {
    window.localStorage.setItem(POSITION_KEY, JSON.stringify(position));
  } catch {
    // Drag position is a browser-only preference.
  }
}

function routeIdForPath(pathname: string | null) {
  if (!pathname || pathname === "/") {
    return "home";
  }

  if (pathname.startsWith("/post/")) {
    return "post";
  }

  if (pathname.startsWith("/search")) {
    return "search";
  }

  if (pathname.startsWith("/pet")) {
    return "pet";
  }

  return "site";
}

function routeLine(routeId: string, stats: BlogPetStats, documentTitle: string) {
  if (routeId === "home") {
    return "我在首页巡逻，闻最新文章的香味。";
  }

  if (routeId === "post") {
    const title = documentTitle.replace(/\s*\|\s*个人博客\s*$/, "").trim();
    const shortTitle = title.length > 28 ? `${title.slice(0, 28)}...` : title;
    const prefix =
      stats.evolution.id === "training"
        ? "我先热身，陪你读"
        : stats.evolution.id === "intel"
          ? "我开着雷达，扫这篇"
          : stats.evolution.id === "balanced"
            ? "我切到均衡模式，陪你读"
            : "我摊开小本子，拆这篇";

    return shortTitle ? `${prefix}：${shortTitle}` : "我在读这篇文章的标题味道。";
  }

  if (routeId === "search") {
    return "我在搜索页探头，帮你找关键词。";
  }

  if (routeId === "pet") {
    return `这里是我的成长记录，当前是${stats.evolution.label}。`;
  }

  return stats.evolution.description;
}

function articleProgressLine(stats: BlogPetStats, milestone: ArticleProgressMilestoneName) {
  const lines = {
    code: {
      half: "读到一半啦，模块和边界开始露出骨架。",
      done: "读完收工，这篇代码脆片我已经夹进小书里。",
      top: "回到标题，我再帮你顺一遍这篇的主线。",
    },
    training: {
      half: "进度过半，节奏稳住，像一组训练做到中段。",
      done: "读完啦，恢复一下，这篇蛋白饭团算完整吃掉。",
      top: "回到顶部，重新摆好站姿再看一遍也很香。",
    },
    intel: {
      half: "扫到一半，信号已经够亮，我继续盯风向。",
      done: "读完啦，热点糖粒入库，巡逻速度 +1。",
      top: "回到顶部，我把关键信号重新标亮。",
    },
    balanced: {
      half: "读到一半，技术、节奏和信息量都挺均衡。",
      done: "读完啦，三种口味都沾了一点，状态很好。",
      top: "回到顶部，我切回导览模式。",
    },
  } satisfies Record<BlogPetStats["evolution"]["id"], Record<ArticleProgressMilestoneName, string>>;

  return lines[stats.evolution.id][milestone];
}

function clickLine(stats: BlogPetStats, routeId: string) {
  if (routeId === "post") {
    if (stats.evolution.id === "training") {
      return "这篇文章像一组有效训练，慢慢读更有劲。";
    }

    if (stats.evolution.id === "intel") {
      return "这篇的信号我先收着，等你读完再入库。";
    }

    if (stats.evolution.id === "balanced") {
      return "这篇给我的三味雷达都点亮了一点。";
    }

    return "这篇文章刚刚给我加了一点灵感。";
  }

  if (stats.dominantAttribute.id === "intelligence") {
    return "标题很有嚼劲，我先记到脑袋里。";
  }

  if (stats.dominantAttribute.id === "stamina") {
    return "再来一篇，我的体力条还能撑。";
  }

  if (stats.dominantAttribute.id === "speed") {
    return "热点味道来了，我先冲去巡逻。";
  }

  return "三种口味都不错，今天也要好好写。";
}

function clampPosition(position: PetPosition, element: HTMLElement | null) {
  const width = element?.offsetWidth ?? 320;
  const height = element?.offsetHeight ?? 220;
  const margin = 8;

  return {
    x: Math.min(Math.max(margin, position.x), Math.max(margin, window.innerWidth - width - margin)),
    y: Math.min(Math.max(margin, position.y), Math.max(margin, window.innerHeight - height - margin)),
  };
}

export function BlogPet() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const latestPositionRef = useRef<PetPosition | null>(null);
  const sheetDragStartYRef = useRef<number | null>(null);
  const articleProgressRef = useRef<ArticleProgressMilestones>({
    ...ARTICLE_PROGRESS_DEFAULTS,
  });
  const suppressClickRef = useRef(false);
  const [stats, setStats] = useState<BlogPetStats | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [sleeping, setSleeping] = useState(false);
  const [paused, setPaused] = useState(false);
  const [idle, setIdle] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [speech, setSpeech] = useState("");
  const [position, setPosition] = useState<PetPosition | null>(null);
  const [panelStyle, setPanelStyle] = useState<PanelPositionStyle>({});
  const [documentTitle, setDocumentTitle] = useState("");
  const routeId = routeIdForPath(pathname);

  useEffect(() => {
    let cancelled = false;

    async function loadPetStats() {
      try {
        const response = await fetch(withBasePath(BLOG_PET_SNAPSHOT_PUBLIC_PATH), {
          cache: "no-store",
        });

        if (!response.ok) {
          return;
        }

        const snapshot = (await response.json()) as BlogPetSnapshot;

        if (!cancelled && snapshot.pet) {
          setStats(snapshot.pet);
        }
      } catch {
        // The floating pet stays hidden if the generated snapshot is absent.
      }
    }

    loadPetStats();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setPaused(readBoolean(PAUSED_KEY));
    const legacyCompact = readBoolean(LEGACY_COMPACT_KEY);
    const storedHidden = readBoolean(HIDDEN_KEY) || legacyCompact;

    setHidden(storedHidden);
    if (legacyCompact) {
      writeBoolean(HIDDEN_KEY, true);
      writeBoolean(LEGACY_COMPACT_KEY, false);
    }
    const storedPosition = readPosition();

    latestPositionRef.current = storedPosition;
    setPosition(storedPosition);
    setDocumentTitle(document.title);
  }, []);

  useEffect(() => {
    latestPositionRef.current = position;
  }, [position]);

  useEffect(() => {
    const media = window.matchMedia(COMPACT_LAYOUT_QUERY);
    const syncViewport = () => setIsNarrow(media.matches);

    syncViewport();
    media.addEventListener("change", syncViewport);

    return () => media.removeEventListener("change", syncViewport);
  }, []);

  useEffect(() => {
    setDocumentTitle(document.title);
    articleProgressRef.current = {
      ...ARTICLE_PROGRESS_DEFAULTS,
    };
  }, [pathname]);

  useEffect(() => {
    if (!stats || routeId !== "post" || sleeping || hidden) {
      return undefined;
    }

    const milestones = articleProgressRef.current;
    const activeStats = stats;

    function readArticleProgress() {
      const article = document.querySelector<HTMLElement>(".article-content");

      if (!article) {
        return 0;
      }

      const rect = article.getBoundingClientRect();
      const scrollY = window.scrollY;
      const articleTop = rect.top + scrollY;
      const articleHeight = Math.max(1, article.scrollHeight || rect.height);
      const probeY = scrollY + window.innerHeight * 0.72;

      return Math.max(0, Math.min(1, (probeY - articleTop) / articleHeight));
    }

    function syncArticleProgress() {
      const progress = readArticleProgress();

      if (window.scrollY > 280) {
        milestones.leftTop = true;
      }

      if (milestones.leftTop && !milestones.returnedTop && window.scrollY < 80) {
        milestones.returnedTop = true;
        setSpeech(articleProgressLine(activeStats, "top"));
        return;
      }

      if (progress >= 0.94 && !milestones.done) {
        milestones.done = true;
        milestones.half = true;
        setSpeech(articleProgressLine(activeStats, "done"));
        return;
      }

      if (progress >= 0.5 && !milestones.half) {
        milestones.half = true;
        setSpeech(articleProgressLine(activeStats, "half"));
      }
    }

    window.addEventListener("scroll", syncArticleProgress, { passive: true });
    window.addEventListener("resize", syncArticleProgress);
    syncArticleProgress();

    return () => {
      window.removeEventListener("scroll", syncArticleProgress);
      window.removeEventListener("resize", syncArticleProgress);
    };
  }, [hidden, routeId, pathname, sleeping, stats]);

  useEffect(() => {
    if (!stats || sleeping || hidden) {
      return;
    }

    try {
      const hasSeenDragHint = window.localStorage.getItem(DRAG_HINT_KEY) === "true";

      if (!hasSeenDragHint) {
        window.localStorage.setItem(DRAG_HINT_KEY, "true");
        setSpeech("可以拖我到不挡正文的位置。");
        return;
      }
    } catch {
      // Route speech is a nice-to-have only.
    }

    if (routeId !== "pet") {
      setSpeech(routeLine(routeId, stats, documentTitle));
    }
  }, [documentTitle, hidden, routeId, sleeping, stats]);

  useEffect(() => {
    if (!stats) {
      return undefined;
    }

    let timer: number | undefined;

    try {
      const lastSeenXp = Number(window.localStorage.getItem(LAST_SEEN_XP_KEY));

      if (!hidden && Number.isFinite(lastSeenXp) && lastSeenXp > 0 && stats.xp > lastSeenXp) {
        setCelebrating(true);
        preparePanelOpen();
        setExpanded(true);
        setSpeech("新文章投喂成功，我升级检查一下。");
        timer = window.setTimeout(() => setCelebrating(false), 4200);
      }

      window.localStorage.setItem(LAST_SEEN_XP_KEY, String(stats.xp));
    } catch {
      return undefined;
    }

    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [hidden, stats]);

  useEffect(() => {
    let timer: number | undefined;

    function resetIdle() {
      window.clearTimeout(timer);
      setIdle(false);
      timer = window.setTimeout(() => {
        setIdle(true);
        setSleeping(true);
        setExpanded(false);
      }, IDLE_MS);
    }

    const events = ["pointermove", "keydown", "scroll", "touchstart"];

    for (const eventName of events) {
      window.addEventListener(eventName, resetIdle, { passive: true });
    }

    resetIdle();

    return () => {
      window.clearTimeout(timer);
      for (const eventName of events) {
        window.removeEventListener(eventName, resetIdle);
      }
    };
  }, []);

  useEffect(() => {
    if (!speech) {
      return undefined;
    }

    const timer = window.setTimeout(() => setSpeech(""), 5200);

    return () => window.clearTimeout(timer);
  }, [speech]);

  useEffect(() => {
    if (!reaction) {
      return undefined;
    }

    const timer = window.setTimeout(() => setReaction(null), 900);

    return () => window.clearTimeout(timer);
  }, [reaction]);

  useEffect(() => {
    if (!expanded) {
      return undefined;
    }

    function handleDocumentPointerDown(event: globalThis.PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node) || rootRef.current?.contains(target)) {
        return;
      }

      setExpanded(false);
      setSpeech("");
    }

    document.addEventListener("pointerdown", handleDocumentPointerDown);

    return () => {
      document.removeEventListener("pointerdown", handleDocumentPointerDown);
    };
  }, [expanded]);

  const currentFood = stats?.latestMeal?.foods[0] ?? stats?.favoriteFood;
  const primaryTask = stats?.tasks.find((task) => !task.completed) ?? stats?.tasks[0];
  const nextLevelText = !stats
    ? ""
    : stats.nextLevelXp === undefined
      ? "已经满级"
      : `距离 Lv.${stats.level + 1} 还差 ${Math.max(0, stats.nextLevelXp - stats.xp)} XP`;
  const attributeSummary = useMemo(() => {
    if (!stats) {
      return "";
    }

    return stats.attributes
      .map((attribute) => `${attribute.label} ${attribute.value}/${attribute.maxValue}`)
      .join(" / ");
  }, [stats]);
  const activeSpeech = stats ? speech : "";
  const stageFormLevel = stats
    ? (stats.stage.formLevel ?? Math.min(10, Math.ceil(stats.level / 5)))
    : 1;
  const stagePhase = stats ? (stats.stage.phase ?? (((stats.level - 1) % 5) + 1)) : 1;
  const rootClassName = stats
    ? [
        "blog-pet",
        `blog-pet--level-${stats.level}`,
        `blog-pet--form-${stageFormLevel}`,
        `blog-pet--phase-${stagePhase}`,
        `blog-pet--${stats.hunger.tone}`,
        `blog-pet--attr-${stats.dominantAttribute.id}`,
        `blog-pet--evolution-${stats.evolution.id}`,
        `blog-pet--route-${routeId}`,
        expanded ? "blog-pet--expanded" : "",
        sleeping ? "blog-pet--sleeping" : "",
        idle ? "blog-pet--idle" : "",
        paused ? "blog-pet--paused" : "",
        dragging ? "blog-pet--dragging" : "",
        celebrating ? "blog-pet--celebrating" : "",
        reaction ? `blog-pet--react-${reaction}` : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "blog-pet";
  const rootStyle = position
    ? ({
        left: position.x,
        top: position.y,
        right: "auto",
        bottom: "auto",
      } as CSSProperties)
    : undefined;
  const panelInlineStyle = isNarrow
    ? undefined
    : ({
        visibility: panelStyle["--pet-panel-top"] ? "visible" : "hidden",
        ...panelStyle,
      } as PanelPositionStyle);

  useLayoutEffect(() => {
    if (!expanded || isNarrow) {
      setPanelStyle({});
      return undefined;
    }

    const update = () => updatePanelPosition();

    update();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [activeSpeech, expanded, isNarrow, position, stats?.level]);

  function calculatePanelPositionStyle(root: HTMLElement | null) {
    if (!root || isNarrow) {
      return null;
    }

    const rect = root.getBoundingClientRect();
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(336, Math.max(260, viewportWidth - margin * 2));
    const availableBelow = viewportHeight - rect.bottom - margin;
    const availableAbove = rect.top - margin;
    const openBelow = availableBelow >= 340 || availableBelow >= availableAbove;
    const availableHeight = Math.max(openBelow ? availableBelow : availableAbove, 280);
    const maxHeight = Math.min(620, viewportHeight - margin * 2, availableHeight - margin);
    const preferredLeft = rect.right - width;
    const left = Math.min(Math.max(margin, preferredLeft), viewportWidth - width - margin);
    const preferredTop = openBelow ? rect.bottom + margin : rect.top - maxHeight - margin;
    const top = Math.min(Math.max(margin, preferredTop), viewportHeight - maxHeight - margin);

    return {
      "--pet-panel-left": `${Math.round(left)}px`,
      "--pet-panel-top": `${Math.round(top)}px`,
      "--pet-panel-width": `${Math.round(width)}px`,
      "--pet-panel-max-height": `${Math.round(maxHeight)}px`,
    } satisfies PanelPositionStyle;
  }

  function updatePanelPosition() {
    const nextPanelStyle = calculatePanelPositionStyle(rootRef.current);

    if (nextPanelStyle) {
      setPanelStyle(nextPanelStyle);
    }
  }

  function preparePanelOpen() {
    const nextPanelStyle = calculatePanelPositionStyle(rootRef.current);

    if (nextPanelStyle) {
      setPanelStyle(nextPanelStyle);
    }
  }

  function wake() {
    setSleeping(false);
    setIdle(false);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const rect = rootRef.current?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const nextPosition = clampPosition(
      {
        x: event.clientX - drag.offsetX,
        y: event.clientY - drag.offsetY,
      },
      rootRef.current
    );

    if (Math.abs(event.clientX - drag.startX) > 4 || Math.abs(event.clientY - drag.startY) > 4) {
      drag.moved = true;
      suppressClickRef.current = true;
      setDragging(true);
      setExpanded(false);
      setSpeech("");
    }

    latestPositionRef.current = nextPosition;
    setPosition(nextPosition);
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const finalPosition = latestPositionRef.current;

    if (drag.moved && finalPosition) {
      writePosition(clampPosition(finalPosition, rootRef.current));
    }

    dragRef.current = null;
    setDragging(false);
    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }

  function handleStatusToggle() {
    wake();
    if (!expanded) {
      preparePanelOpen();
    }
    setExpanded((value) => !value);
  }

  function handleSpriteClick() {
    if (!stats || suppressClickRef.current) {
      return;
    }

    wake();

    if (expanded) {
      setExpanded(false);
      setSpeech("");
      return;
    }

    if (isNarrow || routeId === "pet") {
      if (!expanded) {
        preparePanelOpen();
      }
      setExpanded(true);
    }

    setReaction(stats.dominantAttribute.id === "stamina" ? "stretch" : "nod");
    setSpeech(clickLine(stats, routeId));
  }

  function handleHide() {
    setExpanded(false);
    setSpeech("");
    setHidden(true);
    writeBoolean(HIDDEN_KEY, true);
    writeBoolean(LEGACY_COMPACT_KEY, false);
  }

  function handleRestore() {
    setHidden(false);
    setSleeping(false);
    setIdle(false);
    setExpanded(true);
    writeBoolean(HIDDEN_KEY, false);
    writeBoolean(LEGACY_COMPACT_KEY, false);
  }

  function handlePauseToggle() {
    const nextPaused = !paused;

    setPaused(nextPaused);
    writeBoolean(PAUSED_KEY, nextPaused);
  }

  function handleSleep() {
    setSleeping(true);
    setExpanded(false);
    setSpeech("我先睡一会儿，靠近就醒。");
  }

  function handleScrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: paused ? "auto" : "smooth",
    });
  }

  function handlePanelPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (isNarrow) {
      sheetDragStartYRef.current = event.clientY;
    }
  }

  function handlePanelPointerUp(event: ReactPointerEvent<HTMLElement>) {
    const startY = sheetDragStartYRef.current;

    sheetDragStartYRef.current = null;

    if (isNarrow && startY !== null && event.clientY - startY > 56) {
      setExpanded(false);
      setSpeech("");
    }
  }

  if (!stats) {
    return null;
  }

  if (hidden) {
    if (routeId !== "pet") {
      return null;
    }

    return (
      <button
        className="blog-pet__restore"
        type="button"
        onClick={handleRestore}
        aria-label="唤起博客桌宠"
      >
        <span>唤起桌宠</span>
        <strong>Lv.{stats.level}</strong>
      </button>
    );
  }

  return (
    <aside
      ref={rootRef}
      className={rootClassName}
      style={rootStyle}
      aria-label="博客桌宠"
      aria-live="polite"
      onMouseEnter={wake}
    >
      {activeSpeech ? <div className="blog-pet__bubble">{activeSpeech}</div> : null}

      <button
        className="blog-pet__sprite-button"
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClick={handleSpriteClick}
        aria-expanded={expanded}
        aria-label={isNarrow ? "展开博客桌宠面板" : "和博客桌宠互动"}
        title={isNarrow ? "打开桌宠面板" : "点击互动，拖动可以换位置"}
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

      <div className="blog-pet__quick-actions" aria-label="桌宠快速操作">
        <button
          type="button"
          onClick={handleHide}
          aria-label="隐藏博客桌宠"
          title="隐藏桌宠"
          data-tooltip="隐藏"
        >
          <QuickActionIcon name="hide" />
        </button>
        <button
          type="button"
          onClick={handleSleep}
          aria-label="让桌宠睡觉"
          title="睡觉"
          data-tooltip="睡觉"
        >
          <QuickActionIcon name="sleep" />
        </button>
        <button
          type="button"
          onClick={handlePauseToggle}
          aria-label={paused ? "继续桌宠动画" : "暂停桌宠动画"}
          title={paused ? "继续动画" : "暂停动画"}
          data-tooltip={paused ? "继续动画" : "暂停动画"}
        >
          <QuickActionIcon name={paused ? "play" : "pause"} />
        </button>
        {routeId === "pet" ? (
          <button
            type="button"
            onClick={handleScrollToTop}
            aria-label="回到档案页顶部"
            title="回顶部"
            data-tooltip="回顶部"
          >
            <QuickActionIcon name="top" />
          </button>
        ) : null}
      </div>

      <button
        className="blog-pet__status"
        type="button"
        onClick={handleStatusToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? "收起" : "展开"}博客桌宠状态面板`}
      >
        <div>
          <p className="blog-pet__eyebrow">Blog Pet</p>
          <p className="blog-pet__name">
            {stats.stage.name} · Lv.{stats.level}
          </p>
        </div>
        <span className="blog-pet__pill">{stats.hunger.label}</span>
      </button>

      {expanded ? (
        <section
          ref={panelRef}
          className="blog-pet__panel"
          style={panelInlineStyle}
          onPointerDown={handlePanelPointerDown}
          onPointerUp={handlePanelPointerUp}
          onPointerCancel={() => {
            sheetDragStartYRef.current = null;
          }}
        >
          <button
            className="blog-pet__sheet-handle"
            type="button"
            onClick={() => setExpanded(false)}
            aria-label="下滑或点击收起桌宠面板"
          >
            <span />
          </button>
          <div className="blog-pet__panel-head">
            <div>
              <p className="blog-pet__eyebrow">Feed by Publishing</p>
              <h2>{stats.stage.title}</h2>
            </div>
            <button
              className="blog-pet__close"
              type="button"
              onClick={() => setExpanded(false)}
              aria-label="收起博客桌宠状态"
            >
              x
            </button>
          </div>

          <p className="blog-pet__mood">
            {stats.evolution.label} · {stats.stage.phaseLabel} · {stats.stage.mood}
          </p>
          <p className="blog-pet__growth-hint">{stats.stage.growthHint}</p>

          <div className="blog-pet__controls">
            <button type="button" onClick={handleHide}>
              隐藏桌宠
            </button>
            <button type="button" onClick={handleSleep}>
              睡觉
            </button>
            <button type="button" onClick={handlePauseToggle}>
              {paused ? "继续动画" : "暂停动画"}
            </button>
            <Link href="/pet">档案</Link>
          </div>

          {primaryTask ? (
            <div className="blog-pet__task">
              <span>下一步任务</span>
              <strong>{primaryTask.title}</strong>
              <p>{primaryTask.description}</p>
            </div>
          ) : null}

          <div className="blog-pet__meter-row">
            <div>
              <span>经验</span>
              <strong>{stats.xp} XP</strong>
            </div>
            <div className="blog-pet__meter" style={meterStyle(stats.progressRatio)}>
              <span />
            </div>
            <p>{nextLevelText}</p>
          </div>

          <div className="blog-pet__stats-grid">
            <div>
              <span>投喂</span>
              <strong>{stats.totalMeals} 篇</strong>
            </div>
            <div>
              <span>近 30 天</span>
              <strong>{stats.recentMeals} 篇</strong>
            </div>
            <div>
              <span>连续</span>
              <strong>{stats.streakDays} 天</strong>
            </div>
          </div>

          <div className="blog-pet__meter-row">
            <div>
              <span>饱腹</span>
              <strong>{stats.hunger.label}</strong>
            </div>
            <div
              className="blog-pet__meter blog-pet__meter--hunger"
              style={meterStyle(stats.hunger.ratio)}
            >
              <span />
            </div>
          </div>

          <div className="blog-pet__attributes" aria-label={`属性：${attributeSummary}`}>
            {stats.attributes.map((attribute) => (
              <div key={attribute.id} className="blog-pet__attribute">
                <div>
                  <span>{attribute.label}</span>
                  <strong>
                    {attribute.value}/{attribute.maxValue}
                  </strong>
                </div>
                <div className="blog-pet__mini-meter" style={meterStyle(attribute.ratio)}>
                  <span />
                </div>
              </div>
            ))}
          </div>

          <div className="blog-pet__meal">
            <span>当前流派</span>
            <strong>
              {stats.evolution.title} · {stats.evolution.traitLabel}
            </strong>
          </div>

          {stats.latestMeal ? (
            <Link className="blog-pet__latest" href={`/post/${stats.latestMeal.slug}`}>
              <span>最近投喂</span>
              <strong>{stats.latestMeal.summary}</strong>
              <em>{stats.latestMeal.title}</em>
            </Link>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}
