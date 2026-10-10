// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { PostToc } from "../../components/post-toc";
import { createSectionMarkdown } from "../../lib/content/markdown-export";
import type { Heading } from "../../lib/content/types";

const headings: Heading[] = [
  { id: "实习", text: "实习", depth: 2 },
  { id: "21-权益", text: "2.1 权益", depth: 3 },
  { id: "架构", text: "架构", depth: 4 },
  { id: "22-工作流", text: "2.2 工作流", depth: 3 },
  { id: "其他", text: "其他", depth: 2 },
];
const html = `<h2 id="实习">实习</h2><p>章节简介</p>
  <h3 id="21-权益">2.1 权益</h3><p><strong>权益正文</strong></p>
  <h4 id="架构">架构</h4><p>架构内容</p><h5>细节</h5><p>更深的小节</p>
  <pre><code class="language-js"><span>const title = "### 假标题";</span></code></pre>
  <ul><li>列表内容</li></ul>
  <table><thead><tr><th>方案</th><th>结果</th></tr></thead><tbody><tr><td>A</td><td>通过</td></tr></tbody></table>
  <p><img src="/post-assets/demo/figure.png" alt="架构图"><a href="../reference/">参考</a></p>
  <h3 id="22-工作流">2.2 工作流</h3><p>工作流正文</p>
  <h2 id="其他">其他</h2><p>末章正文</p>`;
const pageUrl = "https://example.com/garden-lab/post/demo/";
let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("copies a chapter with its nested sections and formatting, excluding the next sibling", async () => {
  const markdown = await createSectionMarkdown(html, "21-权益", pageUrl);
  expect(markdown).toMatch(/^### 2\.1 权益/);
  expect(markdown).toContain("**权益正文**");
  expect(markdown).toContain("#### 架构");
  expect(markdown).toContain("更深的小节");
  expect(markdown).toContain('```js\nconst title = "### 假标题";\n```');
  expect(markdown).toContain("- 列表内容");
  expect(markdown).toMatch(/\| 方案\s*\| 结果\s*\|/);
  expect(markdown).toContain("![架构图](https://example.com/post-assets/demo/figure.png)");
  expect(markdown).toContain("[参考](https://example.com/garden-lab/post/reference/)");
  expect(markdown).not.toContain("章节简介");
  expect(markdown).not.toContain("工作流正文");
});

it("includes sibling subsections when copying their parent, and handles the final chapter", async () => {
  const parent = await createSectionMarkdown(html, "实习", pageUrl);
  expect(parent).toContain("章节简介");
  expect(parent).toContain("权益正文");
  expect(parent).toContain("工作流正文");
  expect(parent).not.toContain("末章正文");
  expect(await createSectionMarkdown(html, "其他", pageUrl)).toBe("## 其他\n\n末章正文\n");
  await expect(createSectionMarkdown(html, "missing", pageUrl)).rejects.toThrow("Section heading not found");
});

it("uses actual heading depth and IDs across nested wrappers and duplicate titles", async () => {
  const wrapped = '<section><h3 id="same">同名</h3><p>第一段</p></section><section><h3 id="same-1">同名</h3><p>第二段</p></section><h1>结束</h1><p>不包含</p>';
  expect(await createSectionMarkdown(wrapped, "same", pageUrl)).toBe("### 同名\n\n第一段\n");
  expect(await createSectionMarkdown(wrapped, "same-1", pageUrl)).toBe("### 同名\n\n第二段\n");
});

async function renderToc() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  document.body.innerHTML = `<article>${html}</article><div id="root"></div>`;
  root = createRoot(document.getElementById("root")!);
  await act(async () => root!.render(createElement(PostToc, { headings, contentHtml: html })));
  return document.querySelector<HTMLButtonElement>('[aria-label="复制章节：2.1 权益"]')!;
}

it("copies from a separate directory button without navigating, and keeps heading links working", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  const button = await renderToc();
  expect(document.querySelectorAll("nav button")).toHaveLength(headings.length);
  const push = vi.spyOn(window.history, "pushState");
  await act(async () => button.click());
  expect(writeText).toHaveBeenCalledOnce();
  expect(writeText.mock.calls[0][0]).toContain("权益正文");
  expect(writeText.mock.calls[0][0]).not.toContain("工作流正文");
  expect(button.textContent).toBe("已复制");
  const subsectionButton = document.querySelector<HTMLButtonElement>('[aria-label="复制章节：架构"]')!;
  await act(async () => subsectionButton.click());
  const subsectionMarkdown = writeText.mock.calls[1][0];
  expect(subsectionMarkdown).toMatch(/^#### 架构/);
  expect(subsectionMarkdown).toContain("更深的小节");
  expect(subsectionMarkdown).not.toContain("权益正文");
  expect(subsectionMarkdown).not.toContain("工作流正文");
  expect(subsectionButton.textContent).toBe("已复制");
  expect(push).not.toHaveBeenCalled();
  const target = document.getElementById("21-权益")!;
  target.scrollIntoView = vi.fn();
  act(() => document.querySelector<HTMLAnchorElement>('nav a[href="#21-权益"]')!.click());
  expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "start" });
});

it("offers selected chapter text when both clipboard methods are blocked", async () => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) } });
  Object.defineProperty(document, "execCommand", { configurable: true, value: vi.fn(() => false) });
  const button = await renderToc();
  await act(async () => button.click());
  const textarea = document.querySelector("textarea")!;
  expect(textarea.value).toContain("权益正文");
  expect(textarea.value).not.toContain("工作流正文");
  expect(textarea.selectionEnd).toBe(textarea.value.length);
  expect(document.activeElement).toBe(textarea);
  expect(button.textContent).toBe("重试");
});
