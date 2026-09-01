"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type LightboxState = {
  isOpen: boolean;
  src: string;
  alt: string;
  scale: number;
  position: { x: number; y: number };
};

const INITIAL_STATE: LightboxState = {
  isOpen: false,
  src: "",
  alt: "",
  scale: 1,
  position: { x: 0, y: 0 },
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const DOUBLE_CLICK_ZOOM = 2.4;

export function ArticleImageLightbox({ articleContentId }: { articleContentId: string }) {
  const [state, setState] = useState<LightboxState>(INITIAL_STATE);
  const [isMounted, setIsMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const positionStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const openLightbox = useCallback((src: string, alt: string) => {
    setState({
      isOpen: true,
      src,
      alt,
      scale: 1,
      position: { x: 0, y: 0 },
    });
  }, []);

  const closeLightbox = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // 绑定正文内所有图片：支持点击和双击放大
  useEffect(() => {
    const container = document.getElementById(articleContentId);
    if (!container) return;

    const controller = new AbortController();
    const images = Array.from(container.querySelectorAll<HTMLImageElement>("img"));

    for (const img of images) {
      // 避免重复包装或处理内联图标
      if (img.classList.contains("no-lightbox")) continue;

      img.style.cursor = "zoom-in";
      img.title = img.title || "点击或双击放大查看";

      const handleTrigger = (e: MouseEvent) => {
        // 如果是点击链接内部的图片，阻止默认跳转以放大查看
        e.preventDefault();
        e.stopPropagation();
        openLightbox(img.currentSrc || img.src, img.alt || "");
      };

      img.addEventListener("click", handleTrigger, { signal: controller.signal });
      img.addEventListener("dblclick", handleTrigger, { signal: controller.signal });
    }

    return () => {
      controller.abort();
    };
  }, [articleContentId, openLightbox]);

  // 键盘快捷键监听
  useEffect(() => {
    if (!state.isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLightbox();
      } else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setState((prev) => ({
          ...prev,
          scale: Math.min(MAX_SCALE, +(prev.scale * 1.25).toFixed(2)),
        }));
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setState((prev) => ({
          ...prev,
          scale: Math.max(MIN_SCALE, +(prev.scale / 1.25).toFixed(2)),
        }));
      } else if (e.key === "0") {
        e.preventDefault();
        setState((prev) => ({ ...prev, scale: 1, position: { x: 0, y: 0 } }));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [closeLightbox, state.isOpen]);

  // 滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
    setState((prev) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, +(prev.scale * zoomFactor).toFixed(2)));
      return {
        ...prev,
        scale: nextScale,
        // 如果缩放到 1 或更小，重置平移
        position: nextScale <= 1 ? { x: 0, y: 0 } : prev.position,
      };
    });
  };

  // 双击图片切换 1x 与 放大模式
  const handleImageDoubleClick = (e: React.MouseEvent<HTMLImageElement>) => {
    e.stopPropagation();
    setState((prev) => {
      if (prev.scale > 1.2) {
        return {
          ...prev,
          scale: 1,
          position: { x: 0, y: 0 },
        };
      }
      return {
        ...prev,
        scale: DOUBLE_CLICK_ZOOM,
        position: { x: 0, y: 0 },
      };
    });
  };

  // 鼠标拖拽平移
  const handleMouseDown = (e: React.MouseEvent) => {
    if (state.scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    positionStartRef.current = { ...state.position };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || state.scale <= 1) return;
    e.preventDefault();
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setState((prev) => ({
      ...prev,
      position: {
        x: positionStartRef.current.x + dx,
        y: positionStartRef.current.y + dy,
      },
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setState((prev) => ({
      ...prev,
      scale: Math.min(MAX_SCALE, +(prev.scale * 1.25).toFixed(2)),
    }));
  };

  const handleZoomOut = () => {
    setState((prev) => ({
      ...prev,
      scale: Math.max(MIN_SCALE, +(prev.scale / 1.25).toFixed(2)),
    }));
  };

  const handleResetZoom = () => {
    setState((prev) => ({
      ...prev,
      scale: 1,
      position: { x: 0, y: 0 },
    }));
  };

  if (!isMounted || !state.isOpen) {
    return null;
  }

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label="图片全屏放大预览"
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-between bg-black/85 p-4 backdrop-blur-md select-none transition-opacity duration-200"
      onClick={closeLightbox}
      onWheel={handleWheel}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* 顶部工具栏 */}
      <header
        className="flex w-full max-w-4xl items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/40 px-4 py-2 text-white/90 shadow-2xl backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 text-xs text-white/70">
          <span className="rounded bg-white/15 px-2 py-0.5 font-mono text-[11px] text-white">
            {Math.round(state.scale * 100)}%
          </span>
          <span className="hidden sm:inline">双击图片放大 / 滚轮缩放 / 拖拽平移</span>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="放大"
            title="放大 (+)"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-base font-bold text-white transition hover:bg-white/20 active:scale-95"
          >
            +
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="缩小"
            title="缩小 (-)"
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-base font-bold text-white transition hover:bg-white/20 active:scale-95"
          >
            -
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            aria-label="还原自适应"
            title="还原大小 (0)"
            className="flex h-8 items-center justify-center rounded-lg bg-white/10 px-2.5 text-xs font-medium text-white transition hover:bg-white/20 active:scale-95"
          >
            1:1 适应
          </button>
          <button
            type="button"
            onClick={closeLightbox}
            aria-label="关闭预览"
            title="关闭 (Esc)"
            className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/80 text-lg font-bold text-white transition hover:bg-red-500 active:scale-95"
          >
            ✕
          </button>
        </div>
      </header>

      {/* 图片展示区 */}
      <div
        className="relative flex flex-1 w-full items-center justify-center overflow-hidden py-2"
        onMouseDown={handleMouseDown}
        style={{
          cursor: state.scale > 1 ? (isDragging ? "grabbing" : "grab") : "zoom-out",
        }}
      >
        <img
          src={state.src}
          alt={state.alt}
          onDoubleClick={handleImageDoubleClick}
          onClick={(e) => {
            // 点击图片自身不关闭模态框
            e.stopPropagation();
          }}
          className="max-h-[82vh] max-w-[92vw] object-contain transition-transform duration-100 ease-out select-none shadow-2xl rounded-lg"
          style={{
            transform: `translate(${state.position.x}px, ${state.position.y}px) scale(${state.scale})`,
            transformOrigin: "center center",
            pointerEvents: "auto",
          }}
          draggable={false}
        />
      </div>

      {/* 底部标题栏 */}
      {state.alt ? (
        <footer
          className="max-w-3xl rounded-lg bg-black/60 px-4 py-1.5 text-center text-xs font-medium text-white/80 shadow-lg backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          {state.alt}
        </footer>
      ) : (
        <div className="h-4" />
      )}
    </div>,
    document.body
  );
}
