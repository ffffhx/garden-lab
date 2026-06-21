export const meta = {
  name: 'unified-cost-pertool',
  description: '统一成本轮:单工具顺序跑 30 题(靶场21+外场9)3 chunk,自报 browserOps/escapes,测耗时与成本',
  phases: [
    { title: '靶场A T01-T10b' },
    { title: '靶场B T11-T20' },
    { title: '外场 R01-R09' },
  ],
}

const BENCH = '/Users/bytedance/Code/garden-lab/apps/browser-tool-bench'
const OUT = `${BENCH}/results/unified-2026-06-20-claude-4tools`
const tool = args  // { name, dir, browser }

const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['chunk', 'browserOps', 'escapes', 'results'],
  properties: {
    chunk: { type: 'string' },
    browserOps: { type: 'integer', description: '本chunk真正操作浏览器的次数' },
    escapes: { type: 'integer', description: '本chunk eval/CDP逃生/临时页面脚本次数' },
    results: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['task', 'verdict', 'escape', 'answer', 'notes'],
        properties: {
          task: { type: 'string' },
          verdict: { type: 'string', enum: ['✅', '⚠️', '❌', 'N-R'] },
          escape: { type: 'boolean' },
          answer: { type: 'string' },
          notes: { type: 'string' },
        },
      },
    },
  },
}

const CHUNKS = [
  { id: '靶场A T01-T10b', phase: '靶场A T01-T10b', kind: '靶场(localhost:4399)', cards: 'T01,T02,T03,T04,T05,T06,T07,T08,T09,T10a,T10b', dir: 'tasks' },
  { id: '靶场B T11-T20', phase: '靶场B T11-T20', kind: '靶场(localhost:4399)', cards: 'T11,T12,T13,T14,T15,T16,T17,T18,T19,T20', dir: 'tasks' },
  { id: '外场 R01-R09', phase: '外场 R01-R09', kind: '真实网站外场', cards: 'R01,R02,R03,R04,R05,R06,R07,R08,R09', dir: 'tasks-real' },
]

function prompt(c) {
  return `你是独立子代理（Opus 4.8），跑**统一成本评测**的一个 chunk。先读：
1. 须知（浏览器接入/特殊任务/成本计量规则）：${OUT}/SHARED-BRIEF.md
2. 任务卡：${BENCH}/${c.dir}/ 下对应的 md。

本次只负责这些卡（${c.kind}）：**${c.cards}**。
工具：**${tool.name}**。${tool.browser}

完成后按 schema 返回：每个任务一条（verdict / escape / answer / notes），以及本 chunk 的 \`browserOps\`（真正操作浏览器的次数）和 \`escapes\`（eval/CDP逃生/临时页面脚本次数）。这两个数是本轮成本对比的核心，请客观计数、别少报逃生。

提示：这是成本评测，正常直接地完成，别为省事跳步、也别故意多绕。证据存 ${OUT}/${tool.dir}/。跑不通记 ❌/N-R 写清卡点。`
}

const chunks = []
for (const c of CHUNKS) {
  phase(c.phase)
  const r = await agent(prompt(c), {
    schema: SCHEMA,
    label: `${tool.name} ${c.id}`,
    phase: c.phase,
    agentType: 'general-purpose',
  })
  if (r) chunks.push(r)
}

// 汇总该工具自报指标
const totalOps = chunks.reduce((s, c) => s + (c.browserOps || 0), 0)
const totalEscapes = chunks.reduce((s, c) => s + (c.escapes || 0), 0)
const allResults = chunks.flatMap(c => c.results || [])
const tally = allResults.reduce((m, r) => { m[r.verdict] = (m[r.verdict] || 0) + 1; return m }, {})

return {
  tool: tool.name,
  browser: tool.ownBrowser ? '自管浏览器' : 'CDP 9223',
  totalBrowserOps: totalOps,
  totalEscapes: totalEscapes,
  tally,
  results: allResults,
}
