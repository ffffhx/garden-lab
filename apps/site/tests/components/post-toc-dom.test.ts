// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PostToc } from "../../components/post-toc";

let root: Root;
afterEach(() => {
  act(() => root?.unmount());
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("lands on the selected distant section immediately and keeps the highlight after a scroll event", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const headings = [
    { id: "512-rag", text: "5.1.2 RAG", depth: 4 as const },
    { id: "53-核心能力", text: "5.3 dl-code", depth: 3 as const },
  ];
  document.body.innerHTML = '<h4 id="512-rag"></h4><h3 id="53-核心能力"></h3><div id="root"></div>';
  const target = document.querySelector("h3")!;
  let targetTop = 5000;
  vi.spyOn(document.querySelector("h4")!, "getBoundingClientRect").mockImplementation(() => ({ top: targetTop - 5000 } as DOMRect));
  vi.spyOn(target, "getBoundingClientRect").mockImplementation(() => ({ top: targetTop } as DOMRect));
  const scroll = vi.fn((options: ScrollIntoViewOptions) => {
    // Model smooth scrolling as still in transit; only instant reaches target.
    if (options.behavior === "instant") targetTop = 96;
  });
  target.scrollIntoView = scroll;
  let queued: FrameRequestCallback | undefined;
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => { queued = fn; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  root = createRoot(document.getElementById("root")!);
  act(() => root.render(createElement(PostToc, { headings })));
  const link = document.querySelectorAll("nav a")[1] as HTMLAnchorElement;
  act(() => link.click());
  expect(scroll).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
  expect(decodeURIComponent(location.hash)).toBe("#53-核心能力");
  expect(link.getAttribute("aria-current")).toBe("location");
  act(() => { window.dispatchEvent(new Event("scroll")); queued?.(0); });
  expect(link.getAttribute("aria-current")).toBe("location");
  const push = vi.spyOn(window.history, "pushState");
  act(() => link.click());
  expect(push).not.toHaveBeenCalled();
  scroll.mockClear();
  act(() => link.dispatchEvent(new MouseEvent("click", { bubbles: true, ctrlKey: true })));
  expect(scroll).not.toHaveBeenCalled();
});
