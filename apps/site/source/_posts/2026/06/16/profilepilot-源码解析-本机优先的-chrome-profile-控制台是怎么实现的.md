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
excerpt: "ProfilePilot 站在你日常在用的真实 Chrome 之上补一块控制面：从 Local State 发现 Profile、用 ps/lsof 还原运行态、给隔离 Profile 固定 CDP 端口交给 Agent、把登录态从一个 Profile 安全搬到另一个。这篇拆解它的整体架构，以及账号同步那块「暂存 + 原子替换 + 可回滚」的事务细节——一个 5000 多行 ProfileManager 里真正难的地方。"
cover: "cover-v1.png"
coverPosition: "below-title"
---

## 1. 它解决什么问题，定位在哪

日常用 Chrome 的人都遇到过这些场景：

- 想把一个浏览器交给 Agent 自动化，同时让它带着真实登录。

ProfilePilot 的定位很明确：站在你已经使用的真实 Chrome 数据之上工作，不污染、不抢占你的系统默认的profile。它面向的是日常多 Profile 管理、隔离测试、以及 Agent 自动化这类需要真实登录态的场景。

这个定位决定了它的全部技术选择：要站在真实 Chrome 之上，就只能去读 Chrome 落在磁盘上的真实文件、去解析系统的进程表。**它的工程难度，全部来自「在没有官方 API 的地方，把事情做对、做安全」。**

## 2. 整体架构：三进程 + 一个按职责拆成 11 个模块的主进程核心

先看进程边界。它使用的是 Electron 常见的隔离配置：渲染进程开启上下文隔离、禁用 Node 直连；但 `sandbox` 明确是 `false`，所以这里不能说成 Electron sandbox 模式：

```ts
// src/main/main.ts —— 创建窗口时的关键配置
mainWindow = new BrowserWindow({
  webPreferences: {
    preload: path.join(__dirname, "../preload.js"),
    contextIsolation: true,   // 渲染进程与 preload 的上下文隔离
    nodeIntegration: false,   // 网页里拿不到 require / Node API
    sandbox: false            // 没有启用 Electron sandbox
  }
});
```

渲染进程（`src/renderer/` 下一组纯 UI 模块，共 13 个文件，用 esbuild 打包）不能直接读文件、起进程，它要做任何事都得通过 preload 暴露的桥：

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

主进程 `main.ts` 只做一件事：把渲染进程发来的每个请求（走 IPC，即进程间通信）转发给 `ProfileManager` 这个真正干活的对象。这些真实逻辑——读 `Local State`、跑 `ps`、复制文件、连 CDP——按职责分布在 `src/main/` 下的多个模块里：`chrome-launch.ts`（Profile 扫描 / 启动 / 写 `CLAUDE.md`）、`account-sync.ts`（账号同步事务）、`process-scan.ts`（`ps` / `lsof` 解析）、`cdp-client.ts`（CDP 可达性）、`extension-scan.ts` / `extension-migration.ts`（扩展迁移）、`fs-util.ts` / `fs-copy.ts`（路径校验与拷贝）等，`profile-manager.ts` 自己是约 2000 行的编排层。下文为叙述方便，仍以「ProfileManager」统称这部分主进程核心。

整条调用链长这样：

```
渲染进程 src/renderer/
  → window.profileManager.syncAccount(req)      (preload 桥)
    → ipcRenderer.invoke("profiles:account:sync")
      → main.ts 的 ipcMain.handle
        → profileManager.syncAccount(...)        (主进程核心，拆分到 src/main/ 多个模块)
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

知道「有哪些 Profile」之后，还要知道「谁正在运行、跑在哪个 CDP 端口、监听了哪些端口」。这里的 **CDP（Chrome DevTools Protocol）** 是 Chrome 的远程控制协议：Chrome 带 `--remote-debugging-port` 启动后，外部程序就能通过这个端口操控它——这正是各类浏览器 Agent 接管浏览器的入口，也是后面第 6 节的主角。Chrome 没有 API 告诉你这些运行态，ProfilePilot 的办法是借两个系统自带的命令来「侦察」：`ps`（列出当前所有进程，以及每个进程是用什么命令、带什么参数启动的）和 `lsof`（查某个进程占用了哪些网络端口），再从输出里把信息拼出来。

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

**连接已运行的系统 Chrome** 走的是另一条路（`connectRunningSystemChrome`）：系统 Chrome 通常没带调试端口，ProfilePilot 也不会凭空给它注入一个端口。它做的是聚焦这个系统 Chrome，并打开 Chrome 自带的 `chrome://inspect/#remote-debugging` 入口，让用户在浏览器自己的授权界面里处理后续连接。

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

## 8. 扩展迁移：优先持久写入，必要时才回退

扩展比登录态更麻烦，因为 Chrome 对「扩展能从哪儿来」管得很严。ProfilePilot 第一步是把目标 Profile 里装了哪些扩展摸清楚。它从两个地方拼信息：

- Chrome 把「装了哪些扩展、各自什么状态」记在两个设置文件里——一份普通设置、一份带防篡改校验的设置（文件名就叫 `Preferences` 和 `Secure Preferences`，都是 JSON）。
- 每个扩展自己的文件夹里，还有一份「说明书」（`manifest.json`），写着它的名字、版本、要哪些权限。

把这两边凑起来，就能认出每个扩展的编号、名字、版本和「从哪装的」。这里有个小坑：扩展为了支持多语言，名字往往不直接写出来，只在说明书里填一个占位符（形如 `__MSG_extName__`），真正的中文/英文名另放在一张翻译表里（`_locales/<语言>/messages.json`）。所以遇到占位符，还得再去翻译表里查一次它对应的真名。

先把几个容易混的词拆开：`Preferences` / `Secure Preferences` 不是扩展专用文件，它们还会保存启动页、权限、网站设置等 Profile 配置；这一节只读取和改写其中跟 `extensions` 有关的分支。后面说的「包体」是扩展程序文件本体，比如 `manifest.json`、service worker / background、popup、图标、脚本等；「扩展数据」是另一类东西，指 `Local Extension Settings`、`Sync Extension Settings`、IndexedDB 里按扩展 ID 存的用户配置和运行数据。

认出每个扩展后，当前实现先问的不是「Chrome 是不是 137 以上」，而是：**源 Profile 里有没有 Chrome 自己写过、带保护校验的安装记录**。这条能力在 UI 和 diff 里叫 `canPersistInstall`，判断结果只有两个：`Secure Preferences` 里同时存在 `extensions.settings.<id>`、`protection.macs.extensions.settings.<id>` 和 `settings_encrypted_hash.<id>`，就是有；缺任意一项，就是没有。商店扩展走 Chrome Web Store 正常安装完成后，Chrome 会写出这组记录；本地 unpacked 扩展只有在用户通过 Chrome 自己的「加载已解压的扩展程序」等会落盘到 Profile 的流程登记过，并且这组记录还保留在源 Profile 里时才有。磁盘上只有一个源码目录，或者只是通过 `--load-extension` / `Extensions.loadUnpacked` 临时挂载过，不算有 protected install record。

这条路径的关键点是：它不是用 CDP 去点 Chrome Web Store 的「添加至 Chrome」按钮，也不是每次启动再临时挂载扩展；它把 Chrome 已经承认过的安装记录搬到目标 Profile，让目标 Profile 自己成为这条扩展记录的拥有者。

### ① 本地未打包扩展：持久写入，但继续引用源目录

本地扩展（你自己加载的解压扩展、或非商店来源的）如果有保护记录，ProfilePilot 会把这条安装记录写进目标 Profile 的 `Secure Preferences`。扩展包体不复制，记录里的路径仍然指向源目录。

这样做的效果和 Chrome 原生「加载已解压的扩展程序」一致：目标 Profile 离开 ProfilePilot、用普通 Chrome 启动，也会从这条源目录加载扩展。源目录里的代码原地更新后，目标下次启动也能看到新版本；但代价同样明确：源目录被删除、移动，或者 `manifest.json` 不见了，目标 Profile 里的这条扩展记录就会失效，需要重新同步。

还有一个细节：本地未打包扩展需要 Chrome 的开发者模式。ProfilePilot 没有手写 Chrome 的保护哈希算法，而是启动一个临时 Chrome，通过 CDP 打开 `chrome://extensions/`，再用 `Runtime.evaluate` 调 Chrome WebUI 内部的 `chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true })`。CDP 这里只是执行通道，它本身没有一个专门的「开启开发者模式」协议命令；真正写出记录的是 Chrome 自己。这里得到的也不是某个扩展的签名，而是 Profile 级别的 `extensions.ui.developer_mode = true` 及对应 MAC，ProfilePilot 再把这份开发者模式保护记录写进目标 Profile。

### ② Chrome Web Store 扩展：复制包体 + 迁移保护记录

商店扩展现在也不再默认走「打开商店页、等你点安装」。如果源 Profile 里已经装过这个扩展，ProfilePilot 会把它的包体从源 Profile 的 `Extensions/<id>/<version>` 复制到目标 Profile，再把源 Profile 中 Chrome 写过的 protected install record 同步过去。如果你勾了「连数据一起搬」，`Local Extension Settings`、`Sync Extension Settings`、IndexedDB 这类扩展数据也会按同一个扩展 ID 预先铺到目标。

这里要分清两件事：

- 从 Chrome Web Store **新安装**一个扩展，原生确认框仍然不能被普通 CDP 命令接管；
- 从一个已经安装过的源 Profile **迁移**到另一个本机 Profile，可以复用本机已有包体和 Chrome 已写出的保护记录。

所以，`ExtensionInstallForcelist` 依然是官方支持的企业级静默安装通道；但 ProfilePilot 现在处理的是另一个问题：把用户本机已经安装过的扩展迁移到另一个本机 Profile，而不是替用户从商店发起一次全新的静默安装。

### ③ 回退路径：没有保护记录时才需要运行时加载或安装页

并不是所有扩展都一定能持久迁移。源 Profile 缺少保护记录、扩展目录不完整、或者目标场景不允许写入时，ProfilePilot 才退回旧路径：

| 场景 | 当前主路径 | 离开 ProfilePilot 后是否可用 | 回退路径 |
|---|---|---|---|
| 本地 / 非商店，且三项保护字段齐全 | 写入 `Secure Preferences`，继续引用源目录 | 可用 | 源目录失效时需要重新同步 |
| Chrome Web Store，且有保护记录 | 复制包体到目标 Profile，并写入 protected install record | 可用 | 缺记录时打开商店页 + 预铺数据 |
| 本地 / 非商店，但缺任一保护字段 | 无法持久写入 | 不保证 | 隔离 Profile 可登记为 ProfilePilot 启动时 CDP 加载 |
| 内置组件 / 无说明书 | 跳过 | 不适用 | 跳过 |

迁移前目标 Profile 仍然必须先关闭，因为 Chrome 正在运行时可能会覆盖 `Preferences` / `Secure Preferences`。持久迁移成功后，事实来源是目标 Profile 自己的 Chrome 设置和扩展目录；ProfilePilot 自己的登记记录只服务于「运行时加载」这种回退路径，不再是判断所有扩展是否存在的唯一依据。

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

> 观察基于 `profilepilot@0.1.0` 的源码；主进程核心按职责分布在 `src/main/` 下的多个模块中，编排层是 `src/main/profile-manager.ts`。文中代码均为讲解裁剪版，省略了部分边界分支与日志。
