import { describe, expect, it } from "vitest";

import {
  parseArticleQuizAnswer,
  parseArticleQuizKind,
} from "../../components/article-quiz-enhancer";

describe("article quiz enhancer", () => {
  it("recognizes single-choice and multiple-choice headings", () => {
    expect(parseArticleQuizKind("题 1｜单选题")).toBe("single");
    expect(parseArticleQuizKind("题 18｜多选题")).toBe("multiple");
    expect(parseArticleQuizKind("题 26｜系统设计题")).toBeNull();
  });

  it("extracts and normalizes answer letters from authored details", () => {
    expect(parseArticleQuizAnswer("答案：B。ProfilePilot 是控制面。")).toEqual(["B"]);
    expect(parseArticleQuizAnswer("答案：A、C、D。三项都正确。")).toEqual(["A", "C", "D"]);
    expect(parseArticleQuizAnswer("参考答案：需要下沉到 target。")).toEqual([]);
  });
});
