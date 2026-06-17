---
title: "ProfilePilot 源码解析：一个本机优先的 Chrome Profile 控制台是怎么实现的"
date: 2026-06-16 22:30:00
categories:
  - 技术
tags:
  - Electron
  - Chrome
  - CDP
  - Browser Automation
  - Agent
  - TypeScript
  - 源码解析
excerpt: "ProfilePilot 站在你日常在用的真实 Chrome 之上补一块控制面：从 Local State 发现 Profile、用 ps/lsof 还原运行态、给隔离 Profile 固定 CDP 端口交给 Agent、把登录态从一个 Profile 安全搬到另一个。这篇拆解它的整体架构，以及账号同步那块「暂存 + 原子替换 + 可回滚」的事务细节——一个 4700 行 ProfileManager 里真正难的地方。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 摘要

ProfilePilot 是一个本机优先（local-first）的桌面工具，给你日常在用的真实 Chrome 补上一块缺失的控制面：统一管理 Chrome 自带的 Profile，创建用独立 `--user-data-dir` 隔离的测试环境，把登录态和扩展在 Profile 之间迁移、同步，再以可控的 CDP 端口把一个干净的浏览器交给 Agent 或人工测试。

如果只看 README，你大概会记住这几个标签：

- Electron 桌面应用
- 管理 Chrome 的多 Profile
- 能同步登录态、迁移扩展
- 能给 agent-browser 之类的工具开 CDP 端口

但真正进源码以后，我觉得它最值得讲的是下面这件事：

**它把 Chrome 自己的磁盘数据当作一等公民，在「读真实数据 + 安全地搬运真实数据」这件事上做到了事务级的严谨。**

换句话说，ProfilePilot 的难点在两类系统编程：

- **观测**：在没有官方接口的前提下，靠读 Chrome 的配置文件、解析系统进程表、探测调试端口，把「有哪些 Profile、谁在运行、跑在哪个端口」这套运行态还原出来；
- **搬运**：把登录态和网站数据（Cookies、Local Storage、IndexedDB 等正被浏览器使用的本地数据库），从一个 Profile 安全地复制到另一个，过程可预览、可暂停、可取消，失败了还能回滚。

这篇文章按下面这条主线走：

1. 先把几个词翻成人话
1. 说清它解决什么问题、定位在哪
1. 看整体架构：三进程 + 一个 4700 行的 `ProfileManager`
1. Profile 发现：从 `Local State` 读出真实身份
1. 运行态探测：`ps` + `lsof` 还原「谁在跑、跑在哪个端口」
1. 启动：原生 Profile vs 隔离 Profile，以及跨平台 launcher
1. CDP 接管：固定端口、可达性验证、连接已运行的系统 Chrome
1. 账号同步：全文最硬的一块——暂存 + 原子替换 + 可回滚
1. 扩展迁移：本地走源目录、商店走安装页
1. 外部实例：只读地「看见」agent-browser 们
1. 安全加固：路径、软链、锁、locale
1. 最后把这些串成一条主线

为避免版本漂移，先说明观察范围：

- 仓库：`profilepilot`（Electron + TypeScript）
- 观察版本：`package.json` 中的 `0.1.0`
- 核心文件：`src/main/profile-manager.ts`，约 4700 行
- 观察时间：`2026-06-16`

下面所有代码片段都是**基于源码裁剪后的讲解版**：只保留表达设计意图的主干，去掉了部分边界分支和日志，并补了中文注释。

## 0. 阅读预备：先把几个词翻成人话

- **Chrome Profile**：Chrome 里一个独立的「人」。每个 Profile 有自己的书签、登录态、扩展，对应磁盘上一个目录（`Default`、`Profile 1`…）。
- **`user-data-dir`**：Chrome 的「数据根目录」。所有 Profile 都住在它下面。换一个 `--user-data-dir` 启动，就等于开了一个互相完全隔离的浏览器。
- **`Local State`**：Chrome 在数据根目录下的一个 JSON 文件，记录了「这台机器上有哪些 Profile、各自叫什么名字、绑了哪个 Google 账号」。
- **CDP（Chrome DevTools Protocol）**：Chrome 的远程控制协议。Chrome 带 `--remote-debugging-port=9224` 启动后，外部程序就能通过这个端口用 WebSocket 操控它——这正是各类浏览器 Agent 接管浏览器的入口。
- **原生 Profile / 隔离 Profile**：本文反复出现的一对概念。**原生**指 Chrome 自己那套 `Default`/`Profile N`；**隔离**指 ProfilePilot 用独立 `--user-data-dir` 新建、专门给测试和 Agent 用的环境。
- **Electron 三进程**：主进程（Node，能读文件、起子进程）、渲染进程（网页 UI，不能直接碰系统）、preload（架在两者之间的安全桥）。

记住一句话，后面会轻松很多：

**ProfilePilot 的所有「魔法」都发生在主进程，渲染进程只是个遥控器。**

## 1. 它解决什么问题，定位在哪

日常用 Chrome 的人都遇到过这些场景：

- 想在一个干净环境里复现 bug，同时保持日常浏览器干净；
- 想把主账号的登录态搬到测试 Profile 上跑一遍回归，验证完即弃；
- 想把一个浏览器交给 Agent 自动化，同时让它带着真实登录态。

ProfilePilot 的定位很明确：站在你已经使用的真实 Chrome 数据之上工作，保留浏览器的真实性和本机可解释性。它面向的是日常多 Profile 管理、隔离测试、以及 Agent 自动化这类需要真实登录态的场景。

这个定位决定了它的全部技术选择：要站在真实 Chrome 之上，就只能去读 Chrome 落在磁盘上的真实文件、去解析系统的进程表。**它的工程难度，全部来自「在没有官方 API 的地方，把事情做对、做安全」。**

## 2. 整体架构：三进程 + 一个 4700 行的 ProfileManager

先看进程边界。这是个标准的 Electron 安全配置——渲染进程被彻底沙箱化：

```ts
// src/main/main.ts —— 创建窗口时的关键配置
mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, "../preload.js"),
    contextIsolation: true,   // 渲染进程与 preload 的上下文隔离
    nodeIntegration: false,   // 网页里拿不到 require / Node API
    sandbox: false
  }
});
```

渲染进程（`src/renderer/app.ts`，3700 多行的纯 UI 逻辑）不能直接读文件、起进程，它要做任何事都得通过 preload 暴露的桥：

```ts
// src/preload.ts —— 把一组受控方法挂到 window.profileManager
const profileManagerApi: ProfileManagerApi = {
  getState: () => ipcRenderer.invoke(IPC_CHANNELS.getState),
  syncAccount: (request) => ipcRenderer.invoke(IPC_CHANNELS.syncAccount, request),
  launchProfileWithCdp: (id, port) =>
    ipcRenderer.invoke(IPC_CHANNELS.launchProfileWithCdp, id, port),
  // …每个能力一个方法，全部走 ipcRenderer.invoke
};
contextBridge.exposeInMainWorld("profileManager", profileManagerApi);
```

主进程 `main.ts` 只做一件事：把渲染进程发来的每个请求（走 IPC，即进程间通信）转发给 `ProfileManager` 这个真正干活的对象。所有真实逻辑——读 `Local State`、跑 `ps`、复制文件、连 CDP——都集中在 `src/main/profile-manager.ts` 这一个文件里。

整条调用链长这样：

```
渲染进程 app.ts
  → window.profileManager.syncAccount(req)      (preload 桥)
    → ipcRenderer.invoke("profiles:account:sync")
      → main.ts 的 ipcMain.handle
        → profileManager.syncAccount(...)        (4700 行核心)
          → 读文件 / 跑 ps / 复制目录 / 连 CDP
```

整个应用对外只暴露一个状态对象 `AppState`，几乎每个操作做完都返回最新的 `AppState`，渲染进程拿到就整体重绘。这种「命令 → 返回全量状态」的模式，让 UI 永远不需要自己维护增量，省掉了一大类状态不一致的 bug。

```ts
// AppState 是渲染进程看到的全世界
export interface AppState {
  profiles: PublicProfile[];               // 所有 Profile（原生 + 隔离）
  nativeChromeProfiles: NativeChromeProfile[];
  runningProfiles: PublicProfile[];        // 当前在跑的
  externalInstances: ExternalChromeInstance[]; // 别的工具起的 Chromium
  accountSyncRecords: AccountSyncRecord[];
  // …
}
```

## 3. Profile 发现：从 Local State 读出真实身份

要管理 Chrome 自带的 Profile，第一步是「知道有哪些」。Chrome 把这份名册写在数据根目录下的 `Local State` 里——一个 JSON 文件。ProfilePilot 直接读它：

```ts
// Local State 的结构（裁剪版类型声明）
interface ChromeLocalState {
  profile?: {
    info_cache?: Record<string, {
      name?: unknown;            // 用户给 Profile 起的显示名
      user_name?: unknown;       // 绑定的 Google 账号
      is_using_default_name?: unknown;
    }>;
    last_used?: unknown;
    last_active_profiles?: unknown;
    profiles_order?: unknown;
  };
}
```

`info_cache` 的每个 key 就是磁盘上的目录名（`Default`、`Profile 1`…），value 里有显示名和账号。扫描逻辑把它们映射成统一的 `NativeChromeProfile`：

```ts
// scanNativeChromeProfiles（裁剪）：遍历 info_cache，拼出每个原生 Profile
for (const [dirName, info] of Object.entries(localState.profile.info_cache)) {
  // 关键安全校验：dirName 来自磁盘文件，不能直接拿去拼路径
  if (!isSafePathSegment(dirName)) continue;
  profiles.push({
    dirName,
    name: typeof info.name === "string" ? info.name : dirName,
    userName: typeof info.user_name === "string" ? info.user_name : null,
    path: path.join(userDataDir, dirName),
    isDefault: dirName === "Default"
  });
}
```

注意那行 `isSafePathSegment(dirName)`。`info_cache` 的 key 理论上可被外部篡改，如果里面塞个 `../../something`，后面 `path.join` 就会越界。所以**凡是来自磁盘 / 用户可改文件的字符串，进来第一件事就是校验**——这是贯穿全文的一条安全主线，后面第 11 节还会回到它。

数据根目录本身按平台分叉：

- macOS：`~/Library/Application Support/Google/Chrome`
- Windows：`%LOCALAPPDATA%\Google\Chrome\User Data`
- Linux：`~/.config/google-chrome`

显示名上还有个小心思：默认 Profile 会被覆盖成「系统默认 Profile」这样的友好名，且 ProfilePilot 自己的重命名（存在 registry 里）优先级高于 Chrome 的自动命名。registry 是 ProfilePilot 自己的小数据库（`profiles.json`），存隔离 Profile 列表、原生 Profile 的附加元数据、同步历史等，和 Chrome 的数据完全分开。

## 4. 运行态探测：用 ps + lsof 还原「谁在跑、在哪个端口」

知道「有哪些 Profile」之后，还要知道「谁正在运行、跑在哪个 CDP 端口、监听了哪些端口」。Chrome 没有 API 告诉你这些，ProfilePilot 的办法是借两个系统自带的命令来「侦察」：`ps`（列出当前所有进程，以及每个进程是用什么命令、带什么参数启动的）和 `lsof`（查某个进程占用了哪些网络端口），再从输出里把信息拼出来。

每个 Profile 的运行态被收敛成这样一个结构：

```ts
interface RuntimeProfile {
  pids: number[];           // 该 Profile 的所有相关进程
  startedAt: string | null; // 从 ps 的 lstart 列解析的启动时间
  cdpPort: number | null;   // 从 --remote-debugging-port 解析
  listeningPorts: number[]; // 用 lsof 查出来的监听端口
}
```

实现上靠跑 `ps` 拿到每个进程的完整启动命令，再按 `--profile-directory=` / `--user-data-dir=` / `--remote-debugging-port=` 这些启动参数把进程归类到对应 Profile。这里有一个非常容易踩的坑，作者专门留了注释：

```ts
// ps 的 lstart 等列会跟随系统语言输出（中文环境下是“四  6/11 17:13:50 2026”），
// 而解析逻辑依赖英文格式，所以调用 ps 时统一强制 POSIX locale。
const POSIX_LOCALE_ENV: NodeJS.ProcessEnv = { ...process.env, LC_ALL: "C" };
```

也就是说，所有外部命令调用都强制 `LC_ALL=C`，否则中文系统下 `ps` 会输出「四 6/11」这种本地化日期，把时间解析整懵。这种「在别人地盘上做观测」的活，魔鬼全在这类细节里。

进程识别也做了硬化：用正则匹配完整可执行文件路径，并通过 `--type=` 这个子进程标记把渲染进程、GPU 进程过滤掉，只认主进程，避免把一堆子进程错当成多个浏览器，也避免命令行里偶然出现的「chrome」字样造成误判。

## 5. 启动：原生 Profile vs 隔离 Profile

两类 Profile 的启动命令不同。**原生**靠 `--profile-directory` 指定 Chrome 内部的某个 Profile：

```ts
await launchChrome([`--profile-directory=${profile.dirName}`, "--no-first-run"]);
```

**隔离**则换一个完全独立的 `--user-data-dir`，从而和你的日常 Chrome 互不干扰：

```ts
await launchChrome([
  `--user-data-dir=${profilePath}`,
  "--no-first-run",
  ...launchPlan.launchArgs,  // 比如 --load-extension=…（迁移过来的扩展）
  ...cdpArgs                 // 比如 --remote-debugging-port=9224
]);
```

`launchChrome` 本身是跨平台的，三种系统三种起法：

```ts
async function launchChrome(args: string[]): Promise<void> {
  if (process.env.CHROME_BINARY) {
    launchDetached(process.env.CHROME_BINARY, args);          // 自定义二进制
  } else if (process.platform === "darwin") {
    await execFileAsync("open", ["-na", "Google Chrome", "--args", ...args]); // 走 LaunchServices
  } else if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", "chrome", ...args]);
  } else {
    launchDetached("google-chrome", args);
  }
}
```

直接 `spawn` 的分支都是 detached + `unref()`：让 Chrome 脱离父进程独立活，ProfilePilot 自己退出也不会把浏览器带走。同时监听一次 `error` 事件——这样当可执行文件不存在时不会变成「未处理异常」，而且后面等 CDP 超时的时候，能区分到底是「没起来」还是「起来了但 CDP 没响应」：

```ts
function launchDetached(command: string, args: string[]): void {
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.once("error", (error) => {
    console.error(`[profilepilot] 启动 ${command} 失败：`, error);
  });
  child.unref();
}
```

启动还有并发锁：同一个 Profile 不允许在极短时间内被启动两次（`inFlightLaunches`），否则会出现两个进程抢同一个 `user-data-dir` 的混乱。

## 6. CDP 接管：固定端口、可达性验证、连上已运行的 Chrome

这是 Agent 场景的核心。要把浏览器交给 agent-browser 之类的工具，得给它一个稳定、可达的 CDP 端口。

**端口分配**：优先复用该 Profile 上次用过的端口（`lastCdpPort`），否则从 9222 起找一个空闲的；如果用户为某个 Profile 固定了端口（比如约定俗成的 9224），就锁定它。判断端口是否可用靠尝试 `net.createServer()` 绑定；如果被占，还会用 `lsof` 反查占用者，给出「端口 9224 已被占用，占用者：Google Chrome (PID 1234)」这种能直接定位的报错。

**可达性验证**是这一节最值得看的地方。Chrome 进程起来了，不等于 CDP 就绪了，所以要轮询 `/json/version` 端点：

```ts
async function waitForCdp(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown = null;
  while (Date.now() < deadline) {
    try {
      await requestCdpVersion(port);  // GET /json/version，拿到 webSocketDebuggerUrl 即就绪
      return;
    } catch (error) {
      lastError = error;
      await sleep(200);               // 每 200ms 重试，直到超时
    }
  }
  throw new ProfileManagerError(
    `Chrome 已启动，但 CDP 没有在 127.0.0.1:${port} 响应。` +
      `如果这个 Profile 已有 Chrome 实例在运行（包括之前 CDP 启动后未关闭的窗口），` +
      `新进程会移交给旧实例导致新端口不生效，请先关闭该 Profile 再重试。`,
    "CDP_NOT_READY"
  );
}
```

那段超时文案点破了一个 Chrome 的真实陷阱：**Chrome 是单实例的**——如果同一个 Profile 已经有窗口开着，你再带新端口启动，新进程会把请求移交给旧实例，于是新端口根本不生效。这是用 CDP 接管 Chrome 时最常见的「为什么连不上」，ProfilePilot 直接把诊断写进了错误信息。

**连接已运行的系统 Chrome** 走的是另一条路（`connectRunningSystemChrome`）：系统 Chrome 通常没带调试端口，没法直接连，所以它引导用户用 Chrome 自带的 `chrome://inspect` 远程调试入口来打开授权，授权后再供自动化工具接入。

最后一个很有意思的细节，把这个工具和 Agent 工作流真正打通了。当你给某个隔离 Profile 设了固定端口，ProfilePilot 会把一段配置**原子地写进你的全局 `~/.claude/CLAUDE.md`**，让 Claude Code 这类 Agent 自动知道「该复用哪个调试浏览器」：

```ts
function agentBrowserConfigBlock(profileId: string, name: string, port: number): string {
  return [
    `<!-- profilepilot:agent-cdp profile=${profileId} port=${port} -->`,
    `## 浏览器调试 / 自动化（由 ProfilePilot 维护，请勿手改本块）`,
    ``,
    `需要用浏览器调试或自动化（agent-browser 等）时，优先复用 ProfilePilot 准备好的调试浏览器…`,
    `- CDP 端点：\`http://127.0.0.1:${port}\``,
    `- 接入：先 \`agent-browser connect ${port}\`，再正常操作。`,
    `<!-- /profilepilot:agent-cdp -->`
  ].join("\n");
}
```

写入用的是「写临时文件 → rename 覆盖」的原子写，且用一对 HTML 注释标记把自己的块圈起来，更新时只替换标记之间的内容，保留你 `CLAUDE.md` 里的其它配置。这就是为什么很多人的全局 `CLAUDE.md` 里会出现那段「由 ProfilePilot 维护，请勿手改本块」——它是这段代码写的。

## 7. 账号同步：全文最硬的一块

把登录态从一个 Profile 搬到另一个，是 ProfilePilot 工程上最难的部分。难在哪？因为你要复制的是浏览器存登录态和网站数据的那几样东西——`Cookies`（登录凭据）、`Local Storage`、`IndexedDB`（网页存在本地的数据）、`Sync Data`（账号同步数据），它们都是**浏览器正开着、还在不断读写的本地数据库文件**，而且要保证中途失败时目标 Profile 的原有数据仍然完好。

它分成三步：先对比差异，再带备份地原子替换，最后记录基线。

### 7.1 先对比：算指纹，只搬变化的

同步前先做一次差异对比（`inspectAccountSyncDiff`）：对源和目标的每一类数据算指纹（**把目录里每个文件的"相对路径、大小、修改时间"拼成文本做 SHA256，只看元信息、不读文件内容**），判定每项是「有变化 / 没变化 / 源端没有 / 目标端没有」四种状态之一。界面上据此给出可预览的变更清单，用户能先看清「会动哪些东西」再决定。

为什么用指纹来比？`History`（历史记录）、`IndexedDB`（网页存在本地的数据库）这些动辄上百 MB，逐字节比内容太慢；退一步，只要"有哪些文件、各自多大、最后改于何时"都对得上，就认为两份数据相同，比较瞬间完成。代价是理论上存在"大小和修改时间恰好相同、内容却不同"的误判，但对一个正被写入的数据库文件来说，改了内容、修改时间几乎必然跟着变，所以这是拿极小误判概率换巨大速度的有意取舍。指纹在这里做两件事：源指纹和目标指纹一样就标「没变」、这一项直接跳过；同步成功后还会把源指纹存下来，下次同步时源指纹没变就说明源没动过，照样跳过，免得把大库反复重搬。

要搬哪些数据，写死在一张清单里，覆盖 60 多项，全是 Chrome 在磁盘上的真实文件/文件夹名，按类别归一下：

- **登录态**：`Cookies`（网站登录凭据）等
- **同步数据**：`Sync Data`（账号同步数据）等
- **本地存储**：`Local Storage`、`Session Storage`、`IndexedDB`（网页存在本地的几种数据）等
- **偏好与元数据**：`Preferences`、`Secure Preferences`（Chrome 的两个设置文件，一份普通、一份带防篡改校验）、`Bookmarks`（书签）、`History`（历史）等

### 7.2 暂存 + 原子替换 + 自动回滚

同步是**按 7.1 那张清单逐项做的**：清单里的每一项路径（`Cookies`、`Local Storage`、`IndexedDB`…）各自独立跑一遍下面这套四步事务，整个 Profile 目录并不一次性搬。这样只动清单里的项，目标 Profile 自己那些不在清单里的文件（它自己的 `Local State` 等）原样保留；某一项失败也只影响那一项。

单项的四步流程是这样的——以替换目标的 `Cookies` 为例：

```text
                 目标 Profile 目录
                 ├── Cookies            ← 旧数据（正被使用）
                 └── …其它文件

① 暂存：把【源】的 Cookies 完整拷到目标目录里、和 Cookies 同级的临时目录
        （同一块盘，后面 rename 才能原子）
                 ├── Cookies            （旧，没动）
                 ├── ….partial          ← 源数据的完整副本（慢，可取消）
                 └── …其它文件

② 旧数据让位：rename(Cookies → ….previous)   （瞬间，旧数据整块挪走当备份）
                 ├── ….partial          （新，待上位）
                 ├── ….previous         ← 旧数据完整快照（用于回滚）
                 └── …其它文件

③ 新数据上位：rename(….partial → Cookies)    （瞬间，原子切换）
                 ├── Cookies            ← 新数据已就位
                 ├── ….previous         （备份还留着）
                 └── …其它文件

④ 清理：rm(….previous)                        （确认落定后删备份）
                 ├── Cookies            ← 完成
                 └── …其它文件

   清单里 60 多项，逐项重复 ①②③④。
```

只有 ① 是慢操作（真在拷文件），②③④ 都是文件系统层面的瞬间操作。对应到代码，②③④ 就收在 `replacePathWithStagedCopy` 里：

```ts
async function replacePathWithStagedCopy(stagingPath: string, targetPath: string): Promise<void> {
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const previousPath = makeAccountSyncWorkPath(targetPath, ACCOUNT_SYNC_PREVIOUS_SUFFIX);

  const targetExists = await exists(targetPath);
  if (targetExists) {
    await fs.rm(previousPath, { recursive: true, force: true });
    await fs.rename(targetPath, previousPath);   // ① 旧数据先挪到 .previous 备份
  }

  try {
    await fs.rename(stagingPath, targetPath);     // ② 暂存好的新数据移成正式
  } catch (error) {
    // ②失败：尽力把刚移走的旧数据从 previous 恢复回来
    if (targetExists && !(await exists(targetPath)) && (await exists(previousPath))) {
      try {
        await fs.rename(previousPath, targetPath); // ③ 回滚
      } catch (restoreError) {
        // 连回滚都失败：旧数据仍完整躺在 previousPath，抛出带真实原因的明确错误，
        // 既不静默吞掉，也不删除备份，方便手工恢复。
        throw new ProfileManagerError(
          `替换数据失败且未能自动恢复（…）。原数据已备份在 ${previousPath}` +
            `（可手动改名回 ${path.basename(targetPath)} 恢复）。`,
          "STAGED_REPLACE_RECOVERY_FAILED"
        );
      }
    }
    throw error;
  }

  if (targetExists) {
    await fs.rm(previousPath, { recursive: true, force: true }); // ④ 成功后清理备份
  }
}
```

注意它用的全是 `fs.rename`，而 rename 在同一文件系统内是原子的——这是「不会出现搬到一半的中间态」的关键。三层防御逐级兜底：正常路径成功即清备份；替换失败回滚旧数据；连回滚都失败，就保留备份、把真实原因如实抛成能指明「数据在哪、怎么手动恢复」的明确错误。

#### 为什么非得这么绕——少一步会怎样

这套流程看着啰嗦，但每一步都在堵一个具体的坑。要复制的是 `Cookies`、`Local Storage` 这种动辄上百 MB、且正被浏览器使用的数据库目录，复制本身耗时、可能报错、还可能被用户中途取消。逐步推演一下：

- **如果直接往目标目录里拷（不要"暂存"这一步）**：拷到一半断电 / 报错 / 用户点取消，目标就变成「一半旧文件 + 一半新文件」的残缺状态——登录态正好处于半新半旧，Chrome 一打开很可能直接登录失效甚至数据库损坏。先把源数据完整拷进旁边的 `.partial`，就把「慢且可能失败」的复制全程关在一个临时副本里，**目标在这期间一个字节都没动**。

- **如果暂存好之后，直接就地覆盖目标（省掉"把旧数据移到 `.previous`"这一步）**：覆盖一个已存在的目录得分两步——先把目标里的旧数据就地删掉（`rm -rf`，上百 MB 一样要逐个文件删，既慢又有破坏性），再把新数据移进来。雷就埋在"就地删旧"这一步：删到一半失败，目标半残，而且**旧数据已经被删、再也找不回来**。代码的办法是先 `rename(target → previous)` 把旧数据整体挪走——这一步只在文件系统层面改一下目录指向，不搬数据、不删数据，**瞬间**完成，旧数据还作为一张完整快照留在 `.previous` 里随时能回滚。

- **如果"上正式"这一步也靠复制来做**：复制依然是个有中间态、会拷一半的慢操作，等于把第一个坑又搬了回来。这里改用 `rename`，它在同一文件系统内是**原子**的——要么完全切过去、要么完全没切，不存在"切了一半"。这也是为什么暂存目录必须放在**目标旁边（同一块磁盘）**：跨磁盘的 `rename` 会退化成"复制 + 删除"，原子性就没了。

- **如果替换失败后不回滚（不要第 ③ 步）**：目标已经被移走、新数据又没换上，用户的目标 Profile 就空了。所以 ② 一旦失败，立刻把 `.previous` 改回目标。**连回滚都失败的极端情况**（第 ③ 步也抛错）也兜住了：代码选择保留 `.previous`、并抛出写明「数据备份在哪、怎么手动改名恢复」的错误，把最坏结果从"数据丢了"降级成"数据还在、只是要手动恢复一下"。

一句话：**这套流程的本质，是把"复制"这件随时可能半途而废的事，转化成一串要么全成、要么可回退的原子动作，让目标 Profile 在任何一个时间点被打断，都处于"完整的旧状态"或"完整的新状态"，而绝不会停在中间。**

更进一步，进程如果在同步中途崩了，磁盘上会留下 `.partial` / `.previous` 这类工作残留。下次启动该 Profile 时，会有一段恢复逻辑扫描这些残留：删掉没完成的 `.partial`，如果发现目标丢了但 `.previous` 还在就把它恢复回去，并清理过期备份防止无限堆积。

### 7.3 可暂停、可取消、有进度

整个同步过程接收一个 `AbortSignal`（取消）和一个暂停信号 `OperationPauseSignal`（暂停/继续），并在每个关键节点检查：

```ts
// 主进程里的暂停闸门：暂停时返回一个 Promise 把流程挂住，resume 时统一放行
class OperationPauseController implements OperationPauseSignal {
  private pausedValue = false;
  private waiters: Array<() => void> = [];

  waitIfPaused(): Promise<void> {
    if (!this.pausedValue) return Promise.resolve();
    return new Promise((resolve) => this.waiters.push(resolve)); // 挂起，等 resume
  }
  resume(): void {
    this.pausedValue = false;
    this.waiters.splice(0).forEach((resolve) => resolve());      // 一次性放行所有等待者
  }
}
```

复制循环里每搬完一个文件，就检查一次「是否被取消」和「是否被暂停」，并把进度（已复制几个文件、当前在哪一步）推回界面显示（为避免刷屏，做了节流，大约每 250 毫秒更新一次）。暂停的语义也很克制——点暂停后，会等「当前这个文件复制完」再停，保证每个文件都是完整落地的，界面上的提示也直说了：「已收到暂停请求，当前文件复制完成后会停住。」

### 7.4 记录基线，下次只搬变化

同步成功后，会把这次搬过的各项指纹记到 ProfilePilot 自己的小数据库里。下次再对比时，如果源端指纹自上次同步以来没变，就标成「没变」直接跳过——避免把 `History` 这种大库反复重搬。

## 8. 扩展迁移：本地走源目录，商店走安装页

扩展比登录态更麻烦，因为 Chrome 对「扩展能从哪儿来」管得很严。ProfilePilot 第一步是把目标 Profile 里装了哪些扩展摸清楚。它从两个地方拼信息：

- Chrome 把「装了哪些扩展、各自什么状态」记在两个设置文件里——一份普通设置、一份带防篡改校验的设置（文件名就叫 `Preferences` 和 `Secure Preferences`，都是 JSON）。
- 每个扩展自己的文件夹里，还有一份「说明书」（`manifest.json`），写着它的名字、版本、要哪些权限。

把这两边凑起来，就能认出每个扩展的编号、名字、版本和「从哪装的」。这里有个小坑：扩展为了支持多语言，名字往往不直接写出来，只在说明书里填一个占位符（形如 `__MSG_extName__`），真正的中文/英文名另放在一张翻译表里（`_locales/<语言>/messages.json`）。所以遇到占位符，还得再去翻译表里查一次它对应的真名。

认出每个扩展后，怎么把它「搬」到目标 Profile，取决于两件事：**它是不是商店扩展**，以及**你的 Chrome 是不是新版（137 及以上）**。Chrome 从 137 起在正式版上停用了 `--load-extension` 这个启动参数（防止恶意软件静默侧载），所以加载方式得分版本。按「来源」分两条主线：

### ① 本地扩展（你自己加载的解压扩展、或非商店来源的）—— 从源目录加载，不复制

ProfilePilot 只把「这个扩展在源 Profile 里的目录路径」记下来，启动目标 Profile 时从这个**源目录现读**：

- 旧版 Chrome（< 137）/ Chromium：启动时带上 `--load-extension=<源目录>`；
- 新版 Chrome（≥ 137）：启动时带上调试端口，等浏览器起来后，通过 CDP 通道下一道「加载这个解压扩展」的命令。

两种方式都指向同一个源目录，所以**源扩展更新了，下次通过 ProfilePilot 启动那个 Profile 就是最新的**，目标里也不留副本。代价有两个：它依赖源目录一直在原地（删了、移走就加载不到）；新版 Chrome 因为只能靠 CDP 加载，只要这个 Profile 登记过本地扩展，每次启动都会自动带上一个调试端口。

### ② 商店扩展 —— 旧版可侧载，新版走安装页

商店扩展不允许随便从别处加载（会被 Chrome 判为非法），所以：

- 旧版 Chrome：把它的文件拷进目标 Profile，用 `--load-extension` 侧载；
- 新版 Chrome：打开扩展管理页 / 商店页，引导你点「安装」。如果你勾了「连数据一起搬」，会先按相同编号把它的数据铺到目标，等装完正好对上原来的配置。

剩下两类直接跳过：Chrome 内置组件，以及连说明书都找不到的（多半是坏掉或停用的）。汇总成一张表：

| 扩展来源 | 旧版 Chrome（<137）/ Chromium | 新版 Chrome（≥137） |
|---|---|---|
| 本地 / 非商店 | `--load-extension` 加载**源目录** | CDP 加载**源目录** |
| 商店 | 拷贝文件侧载 | 打开安装页 + 预铺数据 |
| 内置组件 / 无说明书 | 跳过 | 跳过 |

> 一个容易误会的点：本地扩展**不在目标 Profile 里留副本**，每次都从源目录现读。所以「源更新 → 目标自动跟上」是自然结果，不用重新迁移。这一点和 Chrome 原生的「加载已解压的扩展程序」相通——都是原地引用源目录，区别只在于 ProfilePilot 替你在每次启动时自动挂上。

#### 商店扩展为什么只能你点最后一下

新版 Chrome 上，商店扩展走的是「打开商店页、你点『添加至 Chrome』」。常有人问：能不能用 CDP 脚本把这个按钮自动点了、替我装上？卡点在按钮**之后**：

- 页面上那个蓝色「添加至 Chrome」按钮在网页 DOM 里，CDP 确实点得到；
- 但点完会弹出一个**浏览器原生的确认框**（「要添加扩展程序吗？」），它在浏览器外壳里、不在网页 DOM 里。CDP 的鼠标事件只投进网页渲染区，够不到它；也没有任何 CDP 命令能「接受扩展安装确认」（`Page.handleJavaScriptDialog` 只管 `alert`/`confirm` 这类网页 JS 弹窗，安装确认不归它管）。

这道原生确认框正是 Chrome 用来**防止脚本静默安装扩展**的安全设计——能被自动点掉，它就形同虚设了。所以这一下只能真人来。

再叠加前面讲的 ID 问题（商店扩展的 ID 由开发者公钥决定，只有走正规安装才能拿回原 ID），商店扩展的「正确装法」就只剩一条：**从商店重装**。ProfilePilot 能帮的，是把商店页开好、把扩展数据按**原 ID** 预先铺到目标——你点完「添加」，配置正好对上，最后那一下确认留给你。

> 想真正免确认地批量装商店扩展，只有企业的 `ExtensionInstallForcelist` 强制安装策略能做到，但那是系统级托管策略（要管理员配置、用户还卸不掉），不在 ProfilePilot 的范畴里。

迁移前目标 Profile 必须先关闭；哪些扩展登记过以 ProfilePilot 自己的记录为准，万一中途失败，会把已登记的记录（以及商店侧载时拷进去的文件）一起回滚掉。

## 9. 外部实例：只读地「看见」别的工具起的浏览器

这是一个体现「克制」的功能。如果你用 agent-browser、bb-browser 这类工具，它们会自己起 Chromium 实例。ProfilePilot 会把这些「别的工具起的」实例也列出来，但**只读**——只显示、可帮你聚焦或关闭，保持它们的数据原样不动。

识别办法还是解析 `ps`：找带 `--user-data-dir=` 的 Chromium 主进程，且这个 `user-data-dir` 落在「系统 Chrome、ProfilePilot 自己的隔离 Profile、工具自身数据目录」这三者之外，就判定为「外部实例」。再顺手解析出浏览器品牌（Chrome / Chromium / Edge / Brave）、CDP 端口、是否 `--headless`：

```ts
export interface ExternalChromeInstance {
  userDataDir: string;
  browser: string;            // "Google Chrome" / "Chromium" / …
  pid: number;
  cdpPort: number | null;     // 解析 --remote-debugging-port
  cdpUrl: string | null;      // 验证可达后才填
  headless: boolean;          // 匹配 --headless，多半是 agent-browser
}
```

`headless` 这个字段尤其实用：它能一眼区分出「这是个无头的自动化实例」。这也呼应了用户全局规则里那条——优先复用 ProfilePilot 准备好的、带登录态的调试浏览器。

## 10. 安全加固：路径、软链、锁、locale

git log 里有一条「harden profile-manager per multi-agent security audit」，源码里能看到这次审计留下的多道防线。它们看起来都很小，但少一道就可能出大事：

**路径校验**。所有来自磁盘 / 用户可改文件的字符串，拿去拼路径前先过校验：

```ts
function isSafePathSegment(value: string): boolean {
  return Boolean(value)
    && !value.includes("/") && !value.includes("\\")  // 不准带分隔符
    && value !== "." && value !== "..";               // 不准是相对跳转
}
```

同步用的相对路径还会过一道 `normalizeSafeRelativePath`（禁绝对路径、禁 `..` 往上跳目录），扩展说明书里写的路径会过 `resolveWithinBase`（确保拼出来的路径仍落在允许的目录里）。

**软链排除**。复制 Profile 数据时，只复制普通文件和目录，**跳过符号链接**——否则 Profile 里若被塞进一个指向 `/etc/hosts` 的软链，复制时就可能把它带出去，造成越权写入。

**默认 Profile 受保护 + 运行中拒删**。删除前两道闸：默认 Profile 直接拒绝（`DEFAULT_PROFILE_PROTECTED`），删原生 Profile 前还要求 Chrome 已退出，避免删一个正在被使用的目录。

**并发锁**。启动有启动锁、删除有删除锁，防止同一个 Profile 被同时启动两次或删两次；对自己那个小数据库（`profiles.json`）的写入则排成一条队一个个来，配合「写临时文件 → rename」的原子写，杜绝两个操作同时改它、把文件写花。

**优雅关闭，逐级升级信号**。关一个 Profile 时按 AppleScript `quit`（相当于 ⌘Q）→ `SIGTERM` → `SIGKILL` 的顺序逐级升级，每级都给几秒等待——尽量让 Chrome 自己把数据落盘干净。

**locale 硬化**就是第 4 节那个 `LC_ALL=C`：保证 `ps` 输出可被稳定解析，不被系统语言带偏。

## 11. 把这些串成一条主线

回头看，ProfilePilot 的所有设计都从同一个定位长出来：**站在真实 Chrome 之上。** 这个定位带来一条清晰的能力链：

```
发现（读 Local State）
  → 探测运行态（ps + lsof，locale 硬化）
    → 启动（原生 --profile-directory / 隔离 --user-data-dir，跨平台 launcher）
      → 接管（CDP 固定端口 + /json/version 可达性验证 + 写 CLAUDE.md 打通 Agent）
        → 搬运（账号同步：diff → 暂存+原子替换+回滚 → 记录基线）
          → 共存（只读地看见外部实例）
```

而真正把它和「玩具脚本」区分开的，是贯穿始终的两类工程素养：

- **观测要稳**：没有官方 API 的地方，靠解析磁盘文件和进程表把状态还原出来，并为「中文 locale」「Chrome 单实例移交」「端口被占」这些真实坑写了诊断；
- **搬运要安全**：把「复制正在被使用的数据库目录」做成了可预览、可暂停、可取消、失败可回滚、崩溃可恢复的事务。

如果你要拿它做一次分享，我会把落点放在第 7 节那段 `replacePathWithStagedCopy`——它用最朴素的 `fs.rename` 三步，把一个听起来很吓人的「热数据迁移」做成了不会留下中间态的原子操作。**很多工具的差距，恰恰就在这种「失败了会怎样」的地方。**

> 观察基于 `profilepilot@0.1.0`、`2026-06-16` 的源码；核心实现集中在 `src/main/profile-manager.ts`。文中代码均为讲解裁剪版，省略了部分边界分支与日志。
