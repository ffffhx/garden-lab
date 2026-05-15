#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const MODULES = {
  tech: {
    label: "技术",
    examples: ['pnpm new:tech -- "我的第一篇技术文章"', 'pnpm new:post -- "我的第一篇文章"'],
    body: [
      "## 写在前面",
      "",
      "一句话说明这篇文章想解决什么技术问题。",
      "",
      "## 正文",
      "",
      "从这里开始写作。",
      "",
      "## 结尾",
      "",
      "补充总结、参考资料或下一步计划。",
    ],
  },
  fitness: {
    label: "健身",
    examples: ['pnpm new:fitness -- "一周训练复盘"'],
    body: [
      "## 这次记录什么",
      "",
      "一句话说明这篇文章聚焦的训练、饮食或恢复主题。",
      "",
      "## 过程记录",
      "",
      "按动作、计划、饮食或时间线展开。",
      "",
      "## 数据与感受",
      "",
      "记录训练数据、体感变化或执行难点。",
      "",
      "## 总结",
      "",
      "补充阶段结论、调整计划或下一步安排。",
    ],
  },
  "daily-news": {
    label: "每日新闻",
    examples: ['pnpm new:daily-news -- "2026-04-24 AI 与前端热点速览"'],
    body: [
      "## 今日重点",
      "",
      "用几句话概括今天最值得关注的技术新闻。",
      "",
      "## 新闻速览",
      "",
      "按热度或影响排序记录 3 到 5 条新闻。",
      "",
      "## 我的观察",
      "",
      "补充对开发者、产品或行业趋势的判断。",
      "",
      "## 参考链接",
      "",
      "- [来源名称](https://example.com)",
    ],
  },
};

const [, , mode, ...rest] = process.argv;
const args = rest[0] === "--" ? rest.slice(1) : rest;
const title = (args[0] || "").trim();
const moduleConfig = MODULES[mode];

if (!moduleConfig) {
  console.error('用法: node scripts/new-entry.mjs <tech|fitness|daily-news> "标题"');
  process.exit(1);
}

if (!title) {
  console.error("请提供文章标题。");
  moduleConfig.examples.forEach(function (example) {
    console.error(`示例: ${example}`);
  });
  process.exit(1);
}

const now = new Date();
const year = String(now.getFullYear());
const month = String(now.getMonth() + 1).padStart(2, "0");
const day = String(now.getDate()).padStart(2, "0");
const hour = String(now.getHours()).padStart(2, "0");
const minute = String(now.getMinutes()).padStart(2, "0");
const second = String(now.getSeconds()).padStart(2, "0");
const timestamp = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
const category = moduleConfig.label;
const targetDir = path.join(process.cwd(), "source", "_posts", year, month, day);

fs.mkdirSync(targetDir, { recursive: true });

const safeStem = title
  .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
  .replace(/\s+/g, "-")
  .replace(/-+/g, "-")
  .replace(/^-|-$/g, "") || `${mode}-${Date.now()}`;

let filename = `${safeStem}.md`;
let counter = 2;

while (fs.existsSync(path.join(targetDir, filename))) {
  filename = `${safeStem}-${counter}.md`;
  counter += 1;
}

const frontMatter = [
  "---",
  `title: ${JSON.stringify(title)}`,
  `date: ${timestamp}`,
  "categories:",
  `  - ${category}`,
  "tags:",
  "excerpt:",
];

frontMatter.push("---", "");
const body = moduleConfig.body;

const filePath = path.join(targetDir, filename);
fs.writeFileSync(filePath, `${frontMatter.join("\n")}\n${body.join("\n")}\n`, "utf8");

console.log(`已创建: ${path.relative(process.cwd(), filePath)}`);
