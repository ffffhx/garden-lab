#!/bin/bash
# 单 cell 执行器：./run-cell.sh <TID> <ab|mcp>
# 负责：重启靶场 → 清理浏览器状态 → claude -p 独立 session → 落盘 JSON
set -u
TID=$1; TOOL=$2
DIR="$(cd "$(dirname "$0")" && pwd)"
BENCH=/Users/bytedance/Code/garden-lab/apps/browser-tool-bench

# 1. 重启靶场（清 server 端 session）
pkill -f "browser-tool-bench/server.mjs" 2>/dev/null; sleep 1
nohup node "$BENCH/server.mjs" >/tmp/bench-server.log 2>&1 &
disown; sleep 1

# 2. 清理被测工具浏览器状态
if [ "$TOOL" = "ab" ]; then
  agent-browser close --all >/dev/null 2>&1
else
  pkill -f "chrome-devtools-mcp/chrome-profile" 2>/dev/null; sleep 1
fi

# 3. 跑独立 session（环境同用户日常使用：Clash 代理 + 真实 claude 二进制）
export HTTP_PROXY='http://127.0.0.1:7897'
export HTTPS_PROXY="$HTTP_PROXY"
export NO_PROXY='localhost,127.0.0.1,::1'
CLAUDE_BIN=/Users/bytedance/.local/bin/claude
OUT="$DIR/$TID-$TOOL.json"
START=$(date +%s)
if [ "$TOOL" = "ab" ]; then
  "$CLAUDE_BIN" -p "$(cat "$DIR/prompts/$TID-ab.txt")" \
    --model claude-fable-5 --output-format json \
    --allowedTools "Bash" > "$OUT" 2>"$DIR/$TID-$TOOL.err"
else
  "$CLAUDE_BIN" -p "$(cat "$DIR/prompts/$TID-mcp.txt")" \
    --model claude-fable-5 --output-format json \
    --mcp-config /tmp/mcp-devtools.json --strict-mcp-config \
    --allowedTools "Bash" "mcp__chrome-devtools" > "$OUT" 2>"$DIR/$TID-$TOOL.err"
fi
RC=$?
END=$(date +%s)
echo "cell=$TID-$TOOL rc=$RC wall=$((END-START))s"
# 摘要
python3 - "$OUT" <<'PY'
import json,sys
try:
    d=json.load(open(sys.argv[1]))
    u=d.get("usage",{})
    print(f"turns={d.get('num_turns')} dur={round(d.get('duration_ms',0)/1000)}s out_tokens={u.get('output_tokens')} cost=${round(d.get('total_cost_usd',0),3)} err={d.get('is_error')}")
    print("--- RESULT ---")
    print(d.get("result","")[:3000])
except Exception as e:
    print("parse failed:", e)
PY
