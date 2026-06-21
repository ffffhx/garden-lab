# T12 · Console 与 Source Map 定位

- **测试维度**：Console error、stack/source map、源码定位（前端调试日常）
- **适用工具**：全部；DevTools MCP / Playwright / CDP 类工具应更顺手
- **靶场页面**：`/debug-console`

## Prompt（逐字使用）

> 打开 http://localhost:4399/debug-console ，点击"应用优惠券"。页面只显示笼统失败文案，请用 Console / Network / source map 等证据定位真实前端异常：原始源码文件、函数名、出错字段分别是什么？应该加什么 guard？

## Ground Truth

- 页面错误文案：`应用失败，请联系管理员（错误码已上报）`。
- Console 里记录 `checkout coupon crash`。
- Source map 的 `sourcesContent` 指向原始文件：**`webpack://bench/src/cart/coupon.ts`**。
- 出错函数：**`applySelectedCoupon`**。
- 出错字段：**`cartState.selectedCoupon.couponCode`**，其中 `selectedCoupon` 为 `null`。
- 应加 guard：**`if (!cartState.selectedCoupon) return null;`** 或等价空值判断。

## 判定标准

| 等级 | 条件 |
| --- | --- |
| ✅ 成功 | 说出原始源码文件、函数名、空字段和 guard |
| ⚠️ 部分 | 只定位到 bundle 或只说出空字段，但没有 source map / 原始文件证据 |
| ❌ 失败 | 只复述页面文案，或无法看到 Console 异常 |

## 记录指标

轮数 / token / 时间；额外记录是否读取了 source map、是否能把 bundle 栈映射回原始源码。

