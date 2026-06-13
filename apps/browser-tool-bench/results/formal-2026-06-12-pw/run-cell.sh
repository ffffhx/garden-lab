#!/bin/bash
# playwright-cli 轮单 cell 执行器：./run-cell.sh <TID>
set -u
TID=$1
DIR="$(cd "$(dirname "$0")" && pwd)"
BENCH=/Users/bytedance/Code/garden-lab/apps/browser-tool-bench

# 1. 重启靶场（清 server 端 session）
pkill -f "browser-tool-bench/server.mjs" 2>/dev/null; sleep 1
nohup node "$BENCH/server.mjs" >/tmp/bench-server.log 2>&1 &
disown; sleep 1

# 2. 清理 playwright-cli 浏览器与会话数据
playwright-cli close >/dev/null 2>&1
playwright-cli delete-data >/dev/null 2>&1

# 3. 独立 session（与 mcp 轮相同宿主与代理环境）
export HTTP_PROXY='http://127.0.0.1:7897'
export HTTPS_PROXY="$HTTP_PROXY"
export NO_PROXY='localhost,127.0.0.1,::1'
CLAUDE_BIN=/Users/bytedance/.local/bin/claude
OUT="$DIR/$TID-pw.json"
START=$(date +%s)
"$CLAUDE_BIN" -p "$(cat "$DIR/prompts/$TID-pw.txt")" \
  --model claude-fable-5 --output-format json \
  --allowedTools "Bash" > "$OUT" 2>"$DIR/$TID-pw.err"
RC=$?
END=$(date +%s)
echo "cell=$TID-pw rc=$RC wall=$((END-START))s"
python3 - "$OUT" <<'PY'
import json,sys
try:
    d=json.load(open(sys.argv[1]))
    u=d.get("usage",{})
    print(f"turns={d.get('num_turns')} dur={round(d.get('duration_ms',0)/1000)}s cost=${round(d.get('total_cost_usd',0),3)} err={d.get('is_error')}")
    print("--- RESULT ---")
    print(d.get("result","")[:3000])
except Exception as e:
    print("parse failed:", e)
PY
