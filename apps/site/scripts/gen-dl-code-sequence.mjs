import fs from 'node:fs';

// Standalone SVG keeps this sequence visible in the blog and private exports.
const directory = new URL('../source/_posts/2026/08/21/面试准备/', import.meta.url);
const actors = [
  ['ui', '终端界面', 'OpenTUI', 120],
  ['session', '会话管理', 'AgentSession', 370],
  ['agent', '模型与工具循环', 'CodingAgent + LangChain', 650],
  ['model', '模型服务', 'LLM API', 930],
  ['tool', '本地工具', '搜索 / 编辑 / 命令', 1170],
  ['store', '会话存储', 'Journal + JSON', 1420],
];
const steps = [
  ['ui', 'session', '1. 按 Enter，提交修复需求', 'run({ text }) 并开始读取事件'],
  ['session', 'session', '2. 检查没有其他活动运行', '创建 runId、取消信号；追加用户消息'],
  ['session', 'store', '3. 保存用户消息和 running 状态'],
  ['session', 'agent', '4. 调用 execute', '传入历史、取消信号和更新回调'],
  ['agent', 'agent', '5. 准备本次模型输入', '注入规则和 Skills；超预算则压缩'],
  ['agent', 'model', '6. 发送消息与工具定义'],
  ['model', 'agent', '7. 返回工具名与参数', '例如：搜索登录按钮代码', true],
  ['agent', 'tool', '8. LangChain 调用工具函数'],
  ['tool', 'agent', '9. 返回搜索、编辑或检查结果', '', true],
  ['agent', 'session', '10. 更新完整历史', '加入模型消息与工具结果', true],
  ['session', 'store', '11. 保存更新后的会话'],
  ['session', 'ui', '12. 推送事件，界面显示工具结果', '', true],
  ['agent', 'model', '13. 整理最新上下文，再请求模型'],
  ['model', 'agent', '14. 返回回答，不再调用工具', '', true],
  ['agent', 'session', '15. execute 迭代结束', '', true],
  ['session', 'store', '16. 记录 completed 和结束时间，保存'],
  ['session', 'ui', '17. 发出 run_finished，结束忙碌状态', '', true],
];
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const pos = Object.fromEntries(actors.map(([id, , , x]) => [id, x]));
const yAt = i => 240 + i * 86;
const height = yAt(steps.length) + 125;
const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="1540" height="${height}" viewBox="0 0 1540 ${height}" role="img" aria-labelledby="title desc">
<title id="title">dl-code：从一次用户输入到模型与工具循环结束</title>
<desc id="desc">时序从上向下，六个参与方为终端界面、AgentSession、CodingAgent 与 LangChain、模型服务、本地工具及会话存储。模型提出工具调用，本地程序执行，工具结果重新进入下一次模型请求。</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#334155"/></marker></defs>
<style>text{font-family:'Microsoft YaHei','PingFang SC',sans-serif;fill:#172338} .label{font-size:18px;text-anchor:middle} .small{font-size:15px;fill:#53637b;text-anchor:middle} .line{fill:none;stroke:#334155;stroke-width:1.8;marker-end:url(#arrow)} .return{stroke-dasharray:6 4} .life{stroke:#bac5d3;stroke-dasharray:5 7}</style>
<rect width="1540" height="${height}" rx="18" fill="#f8fafc"/>
<text x="42" y="48" font-size="28" font-weight="700">dl-code · 一次编程请求怎样执行</text>
<text x="42" y="80" font-size="18" fill="#53637b">示例：修复登录按钮点击没反应的问题。向下阅读时间，横向箭头表示调用或返回。</text>
<rect x="35" y="${yAt(4)-55}" width="1470" height="${yAt(11)-yAt(4)+91}" rx="10" fill="#eef5ff" stroke="#9bbbe8"/>
<text x="52" y="${yAt(4)-29}" font-size="16" font-weight="700">loop · 只要模型继续要求工具，就重复这一段；每次请求前都重新整理上下文</text>`];
for (const [id, name, code, x] of actors) {
  out.push(`<line class="life" x1="${x}" y1="176" x2="${x}" y2="${height-95}"/>
<rect x="${x-113}" y="112" width="226" height="64" rx="8" fill="${id==='session'?'#dceaff':'#ffffff'}" stroke="#b8c7da"/>
<text class="label" x="${x}" y="138" font-weight="700">${name}</text><text class="small" x="${x}" y="161">${code}</text>`);
}
steps.forEach(([from, to, label, detail = '', returned = false], i) => {
  const a = pos[from], b = pos[to], y = yAt(i), mid = (a+b)/2;
  if (a === b) {
    out.push(`<rect x="${a-132}" y="${y-26}" width="264" height="57" rx="7" fill="#fff8e8" stroke="#dbc78b"/>
<text class="label" x="${a}" y="${y-3}">${escape(label)}</text><text class="small" x="${a}" y="${y+20}">${escape(detail)}</text>`);
  } else {
    out.push(`<path class="line ${returned?'return':''}" d="M${a} ${y+20}H${b}"/>
<text class="label" x="${mid}" y="${y-7}">${escape(label)}</text>${detail?`<text class="small" x="${mid}" y="${y+11}">${escape(detail)}</text>`:''}`);
  }
});
out.push(`<text x="42" y="${height-58}" font-size="17">执行期间：模型文本增量经 AgentSession 推送到 UI；完整消息才写入历史。</text>
<text x="42" y="${height-27}" font-size="17">completed 表示本轮循环正常结束；修复是否有效，要看实际检查结果。异常和取消分别记为 failed / cancelled。</text></svg>`);
fs.mkdirSync(directory, { recursive: true });
fs.writeFileSync(new URL('dl-code-sequence.svg', directory), out.join('\n'));
console.log('Generated dl-code-sequence.svg');
