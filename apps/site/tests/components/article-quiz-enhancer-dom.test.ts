// @vitest-environment jsdom

import fs from "node:fs";
import path from "node:path";

import matter from "gray-matter";
import { afterEach, describe, expect, it } from "vitest";

import { enhanceArticleQuizzes } from "../../components/article-quiz-enhancer";
import { compileMarkdown } from "../../lib/content/markdown";

function quizFixture() {
  const container = document.createElement("article");
  container.innerHTML = `
    <h4>题 1｜单选题</h4>
    <p><strong>问题：单选测试</strong></p>
    <ul><li>A. 错误项</li><li>B. 正确项</li></ul>
    <details><summary><strong>答案与解析</strong></summary><p><strong>答案：B。</strong></p></details>
    <h4>题 2｜多选题</h4>
    <p><strong>问题：多选测试</strong></p>
    <ul><li>A. 正确一</li><li>B. 干扰项</li><li>C. 正确二</li></ul>
    <details><summary><strong>答案与解析</strong></summary><p><strong>答案：A、C。</strong></p></details>
  `;
  document.body.append(container);
  return container;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe("article quiz enhancer DOM behavior", () => {
  it("marks a single choice wrong and then correct on retry", () => {
    const container = quizFixture();
    const cleanup = enhanceArticleQuizzes(container);
    const choices = container.querySelectorAll<HTMLButtonElement>(".article-quiz__choice");
    const feedback = container.querySelector<HTMLParagraphElement>(".article-quiz__feedback");

    choices[0].click();
    expect(feedback?.textContent).toContain("回答错误");
    expect(choices[0].classList.contains("is-wrong")).toBe(true);

    choices[1].click();
    expect(feedback?.textContent).toContain("回答正确");
    expect(choices[1].classList.contains("is-correct")).toBe(true);
    expect(choices[0].classList.contains("is-wrong")).toBe(false);
    cleanup();
  });

  it("compares the exact selected set for a multiple-choice submission", () => {
    const container = quizFixture();
    const cleanup = enhanceArticleQuizzes(container);
    const headings = container.querySelectorAll<HTMLHeadingElement>("h4");
    const multipleOptions = headings[1].nextElementSibling?.nextElementSibling as HTMLUListElement;
    const choices = multipleOptions.querySelectorAll<HTMLButtonElement>(".article-quiz__choice");
    const feedback = multipleOptions.nextElementSibling as HTMLParagraphElement;
    const submit = feedback.nextElementSibling as HTMLButtonElement;

    choices[0].click();
    submit.click();
    expect(feedback.textContent).toContain("回答错误");

    choices[2].click();
    submit.click();
    expect(feedback.textContent).toContain("回答正确");
    expect(choices[0].getAttribute("aria-pressed")).toBe("true");
    expect(choices[2].getAttribute("aria-pressed")).toBe("true");
    cleanup();
  });

  it("enhances every authored single-choice and multiple-choice question in the ProfilePilot article", () => {
    const postPath = path.join(
      process.cwd(),
      "source/_posts/2026/06/16/profilepilot-源码解析-本机优先的-chrome-profile-控制台是怎么实现的.md"
    );
    const source = matter(fs.readFileSync(postPath, "utf8")).content;
    const container = document.createElement("article");
    container.innerHTML = compileMarkdown(source, "/post-assets/profilepilot").contentHtml;
    document.body.append(container);

    const cleanup = enhanceArticleQuizzes(container);
    expect(container.querySelectorAll("h4[data-quiz-enhanced='true']")).toHaveLength(23);
    expect(container.querySelectorAll(".article-quiz__choice").length).toBeGreaterThan(80);
    expect(container.querySelectorAll(".article-quiz__submit")).toHaveLength(12);
    cleanup();
  });
});
