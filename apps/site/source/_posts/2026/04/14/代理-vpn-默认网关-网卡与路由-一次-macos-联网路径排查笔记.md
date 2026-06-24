---
title: "已合并：代理、VPN、Bifrost 与 Clash Verge Rev 的 macOS 链路排查"
slug: vpn-macos
date: 2026-04-14 11:24:38
categories:
  - 技术
tags:
  - 网络
  - 代理
  - VPN
  - Bifrost
  - Clash
  - macOS
  - 路由
excerpt: "这篇旧笔记已经并入 Claude Code 代理配置复盘。新的主文把飞连、Bifrost、Clash Verge Rev 和 Claude Code CLI 放在同一条真实排查链路里说明。"
cover: "cover-v1.png"
coverPosition: "below-title"
hidden: true
---

## 已合并到新的主文

这篇原本只解释“本地代理和公司 VPN 同时开启时，外网流量到底走代理还是走 VPN”。现在公司同事的真实环境通常是：

- 飞连在线，用于公司内网和 VPN / 路由层。
- Bifrost 在线，用于 Coze 等前端调试，并可能写入 macOS 系统代理。
- Clash Verge Rev 在线，底层 Mihomo 负责 Claude 相关域名分流。
- Claude Code CLI 单独依赖 `HTTP_PROXY` / `HTTPS_PROXY`。

所以这篇旧笔记已经合并到主文：

[Claude Code 代理配置复盘：飞连、Bifrost 与 Clash Verge Rev 同时开启时怎么判断链路](../claude-code-ip-clash-verge-rev/)

新的主文里保留了这篇的核心判断方法：

- 用 `scutil --proxy` 判断浏览器第一跳到底是 Bifrost 还是 Clash。
- 用 `route -n get default` 判断飞连是否接管默认路由。
- 用 `route -n get 代理节点IP` 判断“到远端代理节点这段”底层是否进入 VPN。
- 把“请求是否进入代理”和“代理这条链路底层是否走 VPN”分开判断。

一句话：代理、Bifrost、Clash 和飞连不是互斥关系，它们分别工作在不同层。真正要查的是某个应用访问某个域名时，第一跳是谁、是否显式串联、命中了哪条代理规则、底层路由从哪个接口出去。
