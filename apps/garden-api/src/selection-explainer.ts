import type { IncomingMessage, ServerResponse } from "node:http";

import { CONFIG } from "./config.js";

type ExplainSelectionPayload = {
  selection?: string;
  context?: string;
  slug?: string;
  title?: string;
};

type ArticleChatPayload = {
  articleText?: string;
  headings?: string[];
  title?: string;
  messages?: Array<{ role: string; content: string }>;
};

export async function handleExplainSelection(
  req: IncomingMessage,
  res: ServerResponse,
  body: ExplainSelectionPayload
): Promise<void> {
  const selection = body.selection?.trim();
  if (!selection) {
    sendJson(res, 400, { error: "Missing selection text" });
    return;
  }

  if (!CONFIG.KIMI_API_KEY) {
    sendJson(res, 503, { error: "AI service is not configured (missing KIMI_API_KEY)" });
    return;
  }

  const context = body.context?.trim() || "";
  const title = body.title?.trim() || "";

  const systemPrompt = `你是一个资深的技术专家和技术博客阅读助理。读者正在阅读一篇名为《${title}》的技术文章。
请针对读者选中的文字进行简洁、专业、透彻的解释。
如果需要，可以结合上下文进行补充，但请保持回答精炼有条理（通常 1-3 段以内）。`;

  const userPrompt = `【选中文本】：
${selection}

${context ? `【上下文片段】：\n${context}\n` : ""}
请解释这段内容的核心含义、技术背景或关键概念。`;

  try {
    const response = await fetch(`${CONFIG.KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "kimi-k2.5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      sendJson(res, 502, { error: `AI provider error: ${response.status}`, details: errText });
      return;
    }

    const data = (await response.json()) as any;
    const answer = data.choices?.[0]?.message?.content || "未能生成解析内容";

    sendJson(res, 200, { explanation: answer, answer });
  } catch (err: any) {
    sendJson(res, 500, { error: "Failed to call AI provider", message: err.message });
  }
}

export async function handleArticleChat(
  req: IncomingMessage,
  res: ServerResponse,
  body: ArticleChatPayload
): Promise<void> {
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    sendJson(res, 400, { error: "Missing or invalid messages array" });
    return;
  }

  if (!CONFIG.KIMI_API_KEY) {
    sendJson(res, 503, { error: "AI service is not configured (missing KIMI_API_KEY)" });
    return;
  }

  const title = body.title?.trim() || "文章";
  const articleText = body.articleText?.slice(0, 30000) || "";

  const systemPrompt = `你是这篇博客文章《${title}》的专属 AI 讲解员。
你的任务是根据文章内容回答读者的疑问，帮助读者更好地理解文章的思想与技术细节。
回答风格应专业、温和、条理清晰。如果读者问了文章未提及的外部问题，你可以结合技术常识进行解答并注明文章中未提及。

【文章全文参考】：
${articleText}`;

  const promptMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role === "user" ? "user" : "assistant",
      content: String(m.content || ""),
    })),
  ];

  try {
    const response = await fetch(`${CONFIG.KIMI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${CONFIG.KIMI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "kimi-k2.5",
        messages: promptMessages,
        temperature: 0.6,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      sendJson(res, 502, { error: `AI provider error: ${response.status}`, details: errText });
      return;
    }

    const data = (await response.json()) as any;
    const answer = data.choices?.[0]?.message?.content || "";

    sendJson(res, 200, { message: { role: "assistant", content: answer } });
  } catch (err: any) {
    sendJson(res, 500, { error: "Failed to call AI provider", message: err.message });
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
