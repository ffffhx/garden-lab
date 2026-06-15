# AGENTS.md

## 仓库规则

- 每次改动完代码后，必须启动与本次改动相关的本地服务，并把可预览地址告诉用户，让用户可以马上预览效果。
- 操作浏览器的时候优先使用[@chrome](plugin://chrome@openai-bundled)。

## 文章封面（cover-v1.png）

博客封面统一用「印刷感海报」风格（zine / risograph：米白纸底 + 钴蓝/朱红/酸绿 + 粗黑标题 + 半调网点 + 颗粒噪点），不要再用扁平的 SVG 方框流程图。

风格约定：

- **新闻（每日热点速览）**：共用同一套深色「广播台」封面，只随日期和当天关键词变化，保持系列识别度。
- **技术文章**：每篇封面必须是**互不相同**的视觉风格（不同版式 + 不同视觉隐喻，不能只是换个颜色的同一模板）。

生成器在 `design-demos/cover-gen/`，纯本地、可复现：

- `template.html` —— 参数化模板（`?i=N` 渲染第 N 张）。新闻走 `feed` 场景；技术文章按 `slug` 在 `DESIGN` 映射里各有一个独立渲染函数。
- `covers.js` —— 全部封面的文案/场景数据（`window.COVERS` 数组，含 `dir` 输出路径）。
- `render-all.mjs` —— 批量渲染：截图 → sharp 缩放到 1672×940 → 写入文章目录 `cover-v1.png`，并把 frontmatter 的 `cover` 字段切到 png。

新增一篇文章封面的流程：

1. 在 `covers.js` 末尾追加一条数据；新闻用 `news(...)` 辅助函数，技术文章新增一个 `{ slug, dir, ... }` 条目，并在 `template.html` 的 `DESIGN` 映射里为该 `slug` 写一个新的渲染函数（一篇一个独立风格）。
2. 渲染：`node design-demos/cover-gen/render-all.mjs <索引>`（不带参数则全量渲染；可传 `16,17` 只渲染指定几张）。
3. 渲染依赖浏览器截图，会连本机 Chrome 的 CDP（`agent-browser --cdp 9223 set viewport 1600 900 2`）；改了 `template.html` 后注意 file:// 有缓存，`render-all.mjs` 已用 `?cb=` 时间戳强制刷新。

注意：`figure-*.svg` 是文章正文里的插图，和封面无关，不要动。
