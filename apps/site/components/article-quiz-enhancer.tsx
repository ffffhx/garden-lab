"use client";

import { useEffect } from "react";

type QuizKind = "single" | "multiple";

type QuizElements = {
  answer: string[];
  details: HTMLDetailsElement;
  feedback: HTMLParagraphElement;
  heading: HTMLHeadingElement;
  kind: QuizKind;
  options: HTMLUListElement;
  submit: HTMLButtonElement | null;
};

const QUIZ_HEADING_RE = /题\s*\d+\s*[｜|]\s*(单选题|多选题)/;
const ANSWER_RE = /答案[：:]\s*([A-D](?:\s*[、,，]\s*[A-D])*)/;
const OPTION_RE = /^([A-D])[.．、]\s*/;

export function parseArticleQuizKind(text: string): QuizKind | null {
  const match = text.match(QUIZ_HEADING_RE);
  if (match?.[1] === "单选题") return "single";
  if (match?.[1] === "多选题") return "multiple";
  return null;
}

export function parseArticleQuizAnswer(text: string): string[] {
  const answer = text.match(ANSWER_RE)?.[1] || "";
  return [...new Set(answer.match(/[A-D]/g) || [])].sort();
}

function siblingElementsUntilNextHeading(heading: Element): Element[] {
  const result: Element[] = [];
  let current = heading.nextElementSibling;
  while (current && !/^H[234]$/.test(current.tagName)) {
    result.push(current);
    current = current.nextElementSibling;
  }
  return result;
}

function optionLetter(item: HTMLLIElement): string | null {
  const explicit = item.dataset.quizChoice;
  if (explicit && /^[A-D]$/.test(explicit)) return explicit;
  return item.textContent?.trim().match(OPTION_RE)?.[1] || null;
}

function createChoiceButton(item: HTMLLIElement, letter: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "article-quiz__choice";
  button.dataset.quizChoice = letter;
  button.setAttribute("aria-pressed", "false");

  const key = document.createElement("span");
  key.className = "article-quiz__choice-key";
  key.setAttribute("aria-hidden", "true");
  key.textContent = letter;

  const label = document.createElement("span");
  label.className = "article-quiz__choice-label";
  const firstNode = item.firstChild;
  if (firstNode?.nodeType === Node.TEXT_NODE) {
    firstNode.textContent = firstNode.textContent?.replace(OPTION_RE, "") || "";
  }
  while (item.firstChild) label.append(item.firstChild);

  button.append(key, label);
  item.append(button);
  item.dataset.quizChoice = letter;
  return button;
}

function ensureQuizElements(heading: HTMLHeadingElement, kind: QuizKind): QuizElements | null {
  const siblings = siblingElementsUntilNextHeading(heading);
  const options = siblings.find((element): element is HTMLUListElement => element.tagName === "UL");
  const details = siblings.find((element): element is HTMLDetailsElement => element.tagName === "DETAILS");
  if (!options || !details) return null;

  const answer = parseArticleQuizAnswer(details.textContent || "");
  if (answer.length === 0) return null;

  heading.classList.add("article-quiz__heading");
  options.classList.add("article-quiz__options");
  details.classList.add("article-quiz__details");
  details.querySelector("summary")?.classList.add("article-quiz__details-summary");

  for (const item of options.querySelectorAll<HTMLLIElement>(":scope > li")) {
    const letter = optionLetter(item);
    if (!letter) continue;
    item.classList.add("article-quiz__option");
    if (!item.querySelector<HTMLButtonElement>(":scope > .article-quiz__choice")) {
      createChoiceButton(item, letter);
    }
  }

  let feedback = options.nextElementSibling as HTMLParagraphElement | null;
  if (!feedback?.classList.contains("article-quiz__feedback")) {
    feedback = document.createElement("p");
    feedback.className = "article-quiz__feedback";
    feedback.setAttribute("role", "status");
    feedback.setAttribute("aria-live", "polite");
    options.insertAdjacentElement("afterend", feedback);
  }

  let submit: HTMLButtonElement | null = null;
  if (kind === "multiple") {
    submit = feedback.nextElementSibling as HTMLButtonElement | null;
    if (!submit?.classList.contains("article-quiz__submit")) {
      submit = document.createElement("button");
      submit.type = "button";
      submit.className = "article-quiz__submit";
      submit.textContent = "提交答案";
      feedback.insertAdjacentElement("afterend", submit);
    }
  }

  heading.dataset.quizEnhanced = "true";
  return { answer, details, feedback, heading, kind, options, submit };
}

function sameAnswer(selected: Set<string>, answer: string[]): boolean {
  return selected.size === answer.length && answer.every((letter) => selected.has(letter));
}

function setFeedback(elements: QuizElements, state: "idle" | "correct" | "wrong" | "empty"): void {
  const { details, feedback } = elements;
  feedback.classList.remove("is-correct", "is-wrong", "is-empty");
  if (state === "correct") {
    feedback.textContent = "回答正确。可以展开答案查看完整解析。";
    feedback.classList.add("is-correct");
    details.classList.add("is-unlocked");
    return;
  }
  details.classList.remove("is-unlocked");
  if (state === "wrong") {
    feedback.textContent = elements.kind === "multiple"
      ? "回答错误。检查是否漏选或多选，然后再提交一次。"
      : "回答错误。换一个选项再试。";
    feedback.classList.add("is-wrong");
    return;
  }
  if (state === "empty") {
    feedback.textContent = "请至少选择一个选项。";
    feedback.classList.add("is-empty");
    return;
  }
  feedback.textContent = elements.kind === "multiple" ? "可选择多项，选完后提交。" : "选择一个答案，立即查看结果。";
}

function activateQuiz(elements: QuizElements, signal: AbortSignal): void {
  const selected = new Set<string>();
  const buttons = Array.from(elements.options.querySelectorAll<HTMLButtonElement>(".article-quiz__choice"));
  for (const button of buttons) {
    button.classList.remove("is-selected", "is-correct", "is-wrong");
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      const letter = button.dataset.quizChoice || "";
      if (!letter) return;

      if (elements.kind === "single") {
        selected.clear();
        buttons.forEach((candidate) => {
          candidate.classList.remove("is-selected", "is-correct", "is-wrong");
          candidate.setAttribute("aria-pressed", "false");
        });
        selected.add(letter);
        button.classList.add("is-selected");
        button.setAttribute("aria-pressed", "true");
        const correct = sameAnswer(selected, elements.answer);
        button.classList.add(correct ? "is-correct" : "is-wrong");
        setFeedback(elements, correct ? "correct" : "wrong");
        return;
      }

      buttons.forEach((candidate) => candidate.classList.remove("is-correct", "is-wrong"));
      const willSelect = !selected.has(letter);
      if (willSelect) selected.add(letter);
      else selected.delete(letter);
      button.classList.toggle("is-selected", willSelect);
      button.setAttribute("aria-pressed", String(willSelect));
      setFeedback(elements, "idle");
    }, { signal });
  }

  elements.submit?.addEventListener("click", () => {
    if (selected.size === 0) {
      setFeedback(elements, "empty");
      return;
    }
    const correct = sameAnswer(selected, elements.answer);
    for (const button of buttons) {
      const letter = button.dataset.quizChoice || "";
      button.classList.remove("is-correct", "is-wrong");
      if (!selected.has(letter)) continue;
      button.classList.add(correct ? "is-correct" : "is-wrong");
    }
    setFeedback(elements, correct ? "correct" : "wrong");
  }, { signal });

  setFeedback(elements, "idle");
}

export function ArticleQuizEnhancer({ articleContentId }: { articleContentId: string }) {
  useEffect(() => {
    const container = document.getElementById(articleContentId);
    if (!container) return;
    return enhanceArticleQuizzes(container);
  }, [articleContentId]);

  return null;
}

export function enhanceArticleQuizzes(container: HTMLElement): () => void {
  const controller = new AbortController();
  for (const heading of container.querySelectorAll<HTMLHeadingElement>("h4")) {
    const kind = parseArticleQuizKind(heading.textContent || "");
    if (!kind) continue;
    const elements = ensureQuizElements(heading, kind);
    if (elements) activateQuiz(elements, controller.signal);
  }
  return () => controller.abort();
}
