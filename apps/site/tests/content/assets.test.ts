import { afterEach, describe, expect, it } from "vitest";

import {
  getPostAssetBasePath,
  resolveOptimizedAssetUrl,
  resolveOptimizedPostAssetUrl,
  resolvePostAssetUrl,
} from "../../lib/content/assets";

const ORIGINAL_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH;

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) {
    delete process.env.NEXT_PUBLIC_BASE_PATH;
    return;
  }

  process.env.NEXT_PUBLIC_BASE_PATH = ORIGINAL_BASE_PATH;
});

describe("getPostAssetBasePath", () => {
  it("prefixes post asset paths with the configured site base path", () => {
    process.env.NEXT_PUBLIC_BASE_PATH = "/garden-lab";

    expect(
      getPostAssetBasePath("2026/04/15/openai-codex-源码解析-它为什么必须是一个带-harness-的本地-agent.md")
    ).toBe(
      "/garden-lab/post-assets/2026/04/15/openai-codex-源码解析-它为什么必须是一个带-harness-的本地-agent"
    );
  });
});

describe("resolvePostAssetUrl", () => {
  it("resolves relative cover assets against the post asset directory", () => {
    expect(resolvePostAssetUrl("/post-assets/demo", "cover-v2.png")).toBe(
      "/post-assets/demo/cover-v2.png"
    );
  });

  it("encodes non-ascii local asset urls for browser and header safety", () => {
    expect(resolvePostAssetUrl("/post-assets/中文目录", "封面 图.png")).toBe(
      "/post-assets/%E4%B8%AD%E6%96%87%E7%9B%AE%E5%BD%95/%E5%B0%81%E9%9D%A2%20%E5%9B%BE.png"
    );
  });
});

describe("resolveOptimizedAssetUrl", () => {
  it("rewrites local png and jpeg assets to generated webp variants", () => {
    expect(resolveOptimizedAssetUrl("/post-assets/demo/cover-v2.png")).toBe(
      "/post-assets/demo/cover-v2.webp"
    );
    expect(resolveOptimizedAssetUrl("/post-assets/demo/figure-01.jpg")).toBe(
      "/post-assets/demo/figure-01.webp"
    );
  });

  it("keeps external and data urls unchanged", () => {
    expect(resolveOptimizedAssetUrl("https://example.com/cover.png")).toBe(
      "https://example.com/cover.png"
    );
    expect(resolveOptimizedAssetUrl("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc"
    );
  });

  it("optimizes and encodes local image urls", () => {
    expect(resolveOptimizedAssetUrl("/post-assets/中文目录/封面.png")).toBe(
      "/post-assets/%E4%B8%AD%E6%96%87%E7%9B%AE%E5%BD%95/%E5%B0%81%E9%9D%A2.webp"
    );
  });

  it("preserves query strings and hashes while encoding local paths", () => {
    expect(resolveOptimizedAssetUrl("/post-assets/中文目录/封面.png?size=large#hero")).toBe(
      "/post-assets/%E4%B8%AD%E6%96%87%E7%9B%AE%E5%BD%95/%E5%B0%81%E9%9D%A2.webp?size=large#hero"
    );
  });
});

describe("resolveOptimizedPostAssetUrl", () => {
  it("resolves relative post assets to generated webp urls", () => {
    expect(resolveOptimizedPostAssetUrl("/post-assets/demo", "cover-v2.png")).toBe(
      "/post-assets/demo/cover-v2.webp"
    );
  });
});
