import { describe, expect, it } from "vitest";

import {
  buildSelectionExplainMessages,
  parseKimiExplainContent,
  parseSelectionExplainPayload,
} from "../../lib/selection-explainer";

describe("selection explainer", () => {
  it("normalizes valid selection requests", () => {
    const parsed = parseSelectionExplainPayload({
      context: "  这里说的是   agent harness 的边界  ",
      selection: " agent harness ",
      slug: "post-slug",
      title: "测试文章",
    });

    expect(parsed.ok).toBe(true);

    if (parsed.ok) {
      expect(parsed.data.selection).toBe("agent harness");
      expect(parsed.data.context).toBe("这里说的是 agent harness 的边界");
    }
  });

  it("rejects long selections before calling the model", () => {
    const parsed = parseSelectionExplainPayload({
      context: "context",
      selection: "a".repeat(81),
    });

    expect(parsed.ok).toBe(false);

    if (!parsed.ok) {
      expect(parsed.error).toContain("最多解释");
    }
  });

  it("builds a Kimi-oriented prompt with article context", () => {
    const messages = buildSelectionExplainMessages({
      context: "模型对齐阶段常见的方法。",
      selection: "RLHF",
      slug: "rlhf-post",
      title: "什么是 RLHF",
    });

    expect(messages[0].content).toContain("Kimi 联网搜索");
    expect(messages[1].content).toContain("用户选中：RLHF");
    expect(messages[1].content).toContain("文章标题：什么是 RLHF");
  });

  it("parses fenced JSON from Kimi", () => {
    const result = parseKimiExplainContent(
      [
        "```json",
        JSON.stringify({
          context: "这里指根据人类偏好训练模型。",
          extra: "它通常出现在 SFT 之后。",
          meaning: "基于人类反馈的强化学习。",
          sources: [
            {
              title: "OpenAI",
              url: "https://openai.com/",
            },
            {
              title: "bad",
              url: "javascript:alert(1)",
            },
          ],
          term: "RLHF",
        }),
        "```",
      ].join("\n"),
      "RLHF"
    );

    expect(result.term).toBe("RLHF");
    expect(result.meaning).toContain("人类反馈");
    expect(result.sources).toEqual([
      {
        title: "OpenAI",
        url: "https://openai.com/",
      },
    ]);
  });
});
