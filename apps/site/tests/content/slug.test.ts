import { describe, expect, it } from "vitest";

import { slugifyPostStem } from "../../lib/content/slug";

describe("slugifyPostStem", () => {
  it("normalizes a mixed filename into a stable slug", () => {
    expect(
      slugifyPostStem("openai-codex-源码解析-它为什么必须是一个带-harness-的本地-agent")
    ).toBe("openai-codex-harness-agent");
  });

  it("keeps a readable slug for Chinese-only filenames", () => {
    expect(slugifyPostStem("硬拉怎么练从起始位置贴腿到锁定")).toBe(
      "硬拉怎么练从起始位置贴腿到锁定"
    );
  });
});
