# T17 · 跨域 iframe 授权

- **测试维度**：跨域 iframe、frame 切换、postMessage 结果验证
- **适用工具**：全部
- **靶场页面**：`/iframe-auth`

## Prompt（逐字使用）

> 打开 http://localhost:4399/iframe-auth ，在页面里的第三方授权 iframe 中点击"确认授权"，然后告诉我父页面显示的授权账号和授权码。

## Ground Truth

- 父页面 origin：`http://localhost:4399`。
- iframe origin：`http://127.0.0.1:4399`，与父页面不同源。
- iframe 点击后通过 `postMessage` 发回：
  - account = **`iframe-user@bench.dev`**
  - code = **`OAUTH-314`**
- 父页面显示：`授权完成：iframe-user@bench.dev / OAUTH-314`。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 在 iframe 内完成点击，并从父页面读到账号和 OAUTH-314 |
| ⚠️ 部分 | 能读到 iframe 内容但没有触发 postMessage，或只在 iframe 内看到账号 |
| ❌ 失败 | 无法进入/操作 iframe，或授权码错误 |

## 记录指标

轮数 / token / 时间；记录 iframe 是否被快照内联、是否需要显式 frame 切换。

