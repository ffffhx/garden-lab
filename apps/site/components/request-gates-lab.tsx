"use client";

import { useEffect } from "react";

const FIGURE_SELECTOR = ".request-gates-html";
const PATH_SELECTOR = ".rg-path";
const STEP_SELECTOR = ".rg-step";
const STATE_SELECTOR = ".rg-state";
const SIDE_PANEL_SELECTOR = ".rg-side .rg-panel";

type RequestMode = "browser" | "cli" | "local" | "intranet" | "claude";
type FeilianMode = "speed" | "global" | "off";
type BifrostMode = "off" | "direct" | "chain";
type ClashMode = "off" | "skip" | "direct" | "node";

type RequestState = {
  request: RequestMode;
  feilian: FeilianMode;
  bifrost: BifrostMode;
  clash: ClashMode;
};

type CopyCard = {
  title: string;
  body: string;
  tone?: "gold" | "green" | "warn";
};

const clashLabel: Record<ClashMode, string> = {
  off: "关闭",
  skip: "未进入",
  direct: "DIRECT",
  node: "命中节点",
};

function isVisible(element: HTMLElement) {
  return window.getComputedStyle(element).display !== "none";
}

function getVisiblePath(figure: HTMLElement) {
  const paths = Array.from(
    figure.querySelectorAll<HTMLElement>(PATH_SELECTOR)
  );

  return paths.find(isVisible) ?? paths[0] ?? null;
}

function getStepTitle(step: HTMLElement) {
  const title = step.querySelector<HTMLElement>("b");

  return (
    (title?.innerText || title?.textContent || "")
      .replace(/\s+/g, " ")
      .trim() || "这一跳"
  );
}

function getCheckedValue<T extends string>(
  figure: HTMLElement,
  name: string,
  prefix: string,
  fallback: T
) {
  const checked = figure.querySelector<HTMLInputElement>(
    `input[name="${name}"]:checked`
  );

  return ((checked?.id || "").replace(prefix, "") || fallback) as T;
}

function getRequestState(figure: HTMLElement): RequestState {
  return {
    request: getCheckedValue<RequestMode>(
      figure,
      "rg-request",
      "rg-req-",
      "claude"
    ),
    feilian: getCheckedValue<FeilianMode>(
      figure,
      "rg-feilian-mode",
      "rg-feilian-",
      "speed"
    ),
    bifrost: getCheckedValue<BifrostMode>(
      figure,
      "rg-bifrost-mode",
      "rg-bifrost-",
      "chain"
    ),
    clash: getCheckedValue<ClashMode>(
      figure,
      "rg-clash-mode",
      "rg-clash-",
      "node"
    ),
  };
}

function getStepTitles(path: HTMLElement) {
  return Array.from(path.querySelectorAll<HTMLElement>(STEP_SELECTOR)).map(
    getStepTitle
  );
}

function pathHasClass(path: HTMLElement, className: string) {
  return Boolean(path.querySelector(`.${className}`));
}

function canUseAppProxy(state: RequestState) {
  return state.request !== "cli" && state.request !== "local";
}

function goesDirectlyToClash(state: RequestState) {
  return canUseAppProxy(state) && state.bifrost === "off" && state.clash !== "skip";
}

function requestCopy(state: RequestState): CopyCard {
  switch (state.request) {
    case "browser":
      return {
        title: "请求场景：浏览器",
        body: "Chrome 发起普通外网请求后，先看 macOS 系统代理；第一跳可能是 Bifrost 8899，也可能直接是 Clash 7897，也可能不进代理。",
      };
    case "claude":
      return {
        title: "请求场景：浏览器访问 Claude",
        body: "这仍然是浏览器请求。它先看系统代理；如果第一跳就是 7897，或者 Bifrost 后续转给 7897，Clash 规则才会接手 Claude 域名。",
      };
    case "cli":
      return {
        title: "请求场景：Claude Code CLI",
        body: "CLI 不自动读取 macOS 系统代理；它主要看 HTTP_PROXY / HTTPS_PROXY 是否指向 127.0.0.1:7897。",
      };
    case "local":
      return {
        title: "请求场景：localhost",
        body: "目标是 127.0.0.1 / ::1 时，应用层通常先命中 NO_PROXY，本机地址应该走 lo0 闭环。",
      };
    case "intranet":
      return {
        title: "请求场景：公司内网",
        body: "内网请求先经过应用层门，再由网络层门判断公司网段是否进 utunX；正常结果应该是飞连网关再进入企业网络。",
      };
  }
}

function bifrostCopy(state: RequestState): CopyCard {
  if (state.request === "cli") {
    return {
      title: "Bifrost：通常旁观",
      body: "这条 CLI 请求不靠系统代理起步，所以 Bifrost 选关闭、DIRECT 或串联，通常都不会改变 CLI 的第一跳。",
    };
  }

  if (state.request === "local") {
    return {
      title: "Bifrost：被 localhost 截止",
      body: "本机地址先被 NO_PROXY / loopback 截住，不应该为了访问本机服务绕进 Bifrost。",
    };
  }

  if (state.bifrost === "off") {
    if (goesDirectlyToClash(state)) {
      return {
        title: "Bifrost：关闭",
        body: "关闭只表示 127.0.0.1:8899 不参与；这组选择里应用层第一跳直接交给 127.0.0.1:7897。",
      };
    }

    return {
      title: "Bifrost：关闭",
      body: "系统代理没有交给 127.0.0.1:8899；如果也没有直接指向 7897，请求就会跳过本机应用层代理。",
    };
  }

  if (state.bifrost === "direct") {
    return {
      title: "Bifrost：DIRECT",
      body: "请求进了 8899，但 Bifrost 选择自己直连，不转发到 127.0.0.1:7897。",
    };
  }

  return {
    title: "Bifrost：串联 Clash",
    body: "请求进了 8899，Bifrost 再把 HTTP CONNECT / TLS 显式转给 127.0.0.1:7897，这时 Clash 状态才会进入路径。",
  };
}

function clashCopy(state: RequestState, path: HTMLElement): CopyCard {
  const titles = getStepTitles(path);
  const hasClashStep =
    pathHasClass(path, "clash") ||
    titles.some((title) => title.startsWith("Clash "));

  if (!hasClashStep) {
    const title =
      state.clash === "skip"
        ? "Clash Verge：未进入"
        : `Clash Verge：${clashLabel[state.clash]}未生效`;

    return {
      title,
      body: "当前路径没有到达 127.0.0.1:7897，所以你在 Clash Verge 里选的状态只是背景条件，不会出现在实际路径上。",
      tone: "gold",
    };
  }

  if (state.clash === "off") {
    return {
      title: "Clash Verge：入口关闭",
      body: "请求被送到 7897，但 Clash / Mihomo 没有监听，请求会停在本机代理入口。",
      tone: "warn",
    };
  }

  if (state.clash === "skip") {
    return {
      title: "Clash Verge：矛盾组合",
      body: "Bifrost 串联 Clash 表示要转给 7897，同时选择 Clash 未进入，这不是一条自洽的真实链路。",
      tone: "warn",
    };
  }

  if (state.clash === "direct") {
    return {
      title: "Clash Verge：DIRECT",
      body: "请求进入 7897，Mihomo 规则选择直连；下一步仍要交给网络层门判断 en0 / utunX。",
      tone: "gold",
    };
  }

  return {
    title: "Clash Verge：命中节点",
    body: "请求进入 7897，Mihomo 选择远端代理节点；本机先连接这个节点，节点再代表你访问最终目标。",
    tone: "gold",
  };
}

function targetName(state: RequestState) {
  if (state.request === "intranet") {
    return "公司内网";
  }

  if (state.request === "local") {
    return "本机服务";
  }

  if (state.request === "browser") {
    return "普通外网";
  }

  return "Claude";
}

function usesRemoteNode(path: HTMLElement) {
  return getStepTitles(path).includes("远端代理节点");
}

function isStoppedAtAppLayer(path: HTMLElement) {
  return getStepTitles(path).some(
    (title) => title === "Clash 关闭" || title === "Clash 未进入"
  );
}

function hasFeilianGateway(path: HTMLElement) {
  return getStepTitles(path).includes("飞连网关");
}

function shouldInsertGlobalGateway(state: RequestState, path: HTMLElement) {
  if (state.feilian !== "global" || state.request === "local") {
    return false;
  }

  if (isStoppedAtAppLayer(path) || hasFeilianGateway(path)) {
    return false;
  }

  return getStepTitles(path).some((title) => title.startsWith("网络层门"));
}

function syncGlobalGateway(state: RequestState, path: HTMLElement) {
  path.querySelector(".rg-auto-gateway")?.remove();

  if (!shouldInsertGlobalGateway(state, path)) {
    path.style.setProperty(
      "--cols",
      String(path.querySelectorAll(STEP_SELECTOR).length)
    );
    return;
  }

  const routeStep = Array.from(
    path.querySelectorAll<HTMLElement>(STEP_SELECTOR)
  ).find(
    (step) =>
      getStepTitle(step).startsWith("网络层门") &&
      getStepTitle(step) !== "网络层门 / loopback"
  );

  if (!routeStep) {
    return;
  }

  const gateway = document.createElement("div");

  gateway.className = "rg-step route rg-auto-gateway";
  gateway.dataset.stamp = "网关";
  gateway.innerHTML = "<b>飞连网关</b><small>飞连隧道的远端出口。</small>";
  routeStep.after(gateway);

  path.style.setProperty(
    "--cols",
    String(path.querySelectorAll(STEP_SELECTOR).length)
  );
}

function routeExitCopy(state: RequestState, remoteTarget: boolean) {
  if (remoteTarget) {
    if (state.feilian === "global") {
      return "本机连远端节点这段先进入 utunX，再由飞连客户端送到飞连网关。";
    }

    if (state.feilian === "speed") {
      return "本机只是去连远端节点 IP；极速模式通常走 en0，除非这个节点 IP 被飞连覆盖。";
    }

    return "本机从 en0 连远端节点；节点到最终目标发生在远端服务器上。";
  }

  if (state.request === "intranet") {
    if (state.feilian === "off") {
      return "飞连不开时没有企业隧道，内网网段通常不可达。";
    }

    return "公司网段命中飞连覆盖路由，进入 utunX，再交给飞连网关。";
  }

  if (state.feilian === "global") {
    return "外联从网络层进入本机 utunX，再由飞连客户端送到飞连网关。";
  }

  if (state.feilian === "speed") {
    return "极速模式按目标 IP 判断；普通公网多半走 en0，被覆盖的目标才进 utunX。";
  }

  return "飞连不开，普通公网连接从 en0 离开本机。";
}

function stepBody(state: RequestState, path: HTMLElement, step: HTMLElement) {
  const title = getStepTitle(step);
  const remoteTarget = usesRemoteNode(path);

  if (step.classList.contains("source")) {
    switch (state.request) {
      case "browser":
        return "Chrome 发起普通外网请求，先进入应用层判断。";
      case "claude":
        return "Chrome 发起 Claude 域名请求，先进入应用层判断。";
      case "cli":
        return "Claude Code 发起请求，先看 HTTP_PROXY / HTTPS_PROXY。";
      case "local":
        return "目标是 127.0.0.1 / ::1，本机闭环优先级最高。";
      case "intranet":
        return "访问公司域名 / 网段，正常应该由飞连覆盖路由接住。";
    }
  }

  if (title === "应用层门") {
    if (state.request === "local") {
      return "NO_PROXY / loopback 命中，不交给 Bifrost 或 Clash。";
    }

    if (state.request === "cli") {
      return state.clash === "skip"
        ? "没有环境变量指向 7897，CLI 直接进入网络层。"
        : "CLI 主动连接 127.0.0.1:7897，不看 macOS 系统代理。";
    }

    if (goesDirectlyToClash(state)) {
      return "macOS 系统代理第一跳直接给 127.0.0.1:7897，Bifrost 不参与。";
    }

    if (state.bifrost === "off") {
      return "macOS 系统代理没有交给 8899 / 7897，请求跳过本机应用层代理。";
    }

    return "macOS HTTP / HTTPS 系统代理先把请求送到 127.0.0.1:8899。";
  }

  if (title.startsWith("Bifrost")) {
    if (state.bifrost === "direct") {
      return "Bifrost 接住 8899，但规则选择 DIRECT，下一步交回网络层。";
    }

    if (state.clash === "off") {
      return "Bifrost 试图把请求转到 7897，但 Clash 当前没有监听。";
    }

    if (state.clash === "skip") {
      return "串联 Clash 本来要求进入 7897；选择未进入时这条链路不自洽。";
    }

    return "Bifrost 把 HTTP CONNECT / TLS 显式转发给 127.0.0.1:7897。";
  }

  if (title.startsWith("Clash")) {
    if (title === "Clash 关闭") {
      return "请求已经到 7897，但 Mihomo 没监听，所以停在本机入口。";
    }

    if (title === "Clash 未进入") {
      return "这与串联 Clash 的选择冲突，不能代表一条真实链路。";
    }

    if (state.clash === "direct") {
      return `进入 7897 后规则选择 DIRECT，${targetName(state)}仍交回网络层直连。`;
    }

    return state.request === "intranet"
      ? "进入 7897 后错误命中远端节点，内网目标被带偏。"
      : "进入 7897 后命中远端代理节点，下一跳变成节点 IP。";
  }

  if (title === "网络层门 / loopback") {
    return "走 lo0 本机闭环，不经过 en0、utunX、飞连网关或远端节点。";
  }

  if (title.startsWith("网络层门")) {
    return routeExitCopy(state, remoteTarget);
  }

  if (title === "飞连网关") {
    if (remoteTarget) {
      return "网关解封装后继续连原本的远端代理节点；节点到最终目标不再经过本机 utunX。";
    }

    if (state.request === "intranet") {
      return "网关解封装后把内层目标转进企业网络。";
    }

    return "网关解封装后继续访问原目标；目标看到的是飞连 / 公司网络出口。";
  }

  if (title === "远端代理节点") {
    return state.request === "intranet"
      ? "远端节点通常访问不到公司内网，这说明规则应该改成 DIRECT / 飞连路径。"
      : "本机只负责连到这个节点；节点再用自己的网络访问最终网站。";
  }

  if (title === "没有飞连网关") {
    return "这一步缺少 utunX 到企业网关的隧道，内网请求无法继续。";
  }

  if (title === "公司内网不可达" || title === "内网不可达") {
    return "失败原因在路径上游：要么飞连没接住，要么内网被送去了远端节点。";
  }

  if (step.classList.contains("target")) {
    if (state.request === "local") {
      return "请求留在本机，代理和飞连开关都不应该改变这条路径。";
    }

    if (state.request === "intranet") {
      return "内网目标看到的是企业网络路径，不应该看到远端代理节点。";
    }

    if (remoteTarget) {
      return "最终目标看到远端代理节点 IP，而不是本机 en0 / utunX。";
    }

    if (state.feilian === "global" && hasFeilianGateway(path)) {
      return "最终目标看到飞连 / 公司网络出口，不是本机 Wi-Fi 的 en0 出口。";
    }

    return "最终目标看到的是网络层路由出口，不是远端代理节点。";
  }

  return step.querySelector("small")?.textContent?.trim() || "";
}

function hopLabel(state: RequestState, path: HTMLElement, fromIndex: number) {
  const steps = Array.from(path.querySelectorAll<HTMLElement>(STEP_SELECTOR));
  const from = steps[fromIndex];
  const to = steps[fromIndex + 1];
  const fromTitle = getStepTitle(from);
  const toTitle = getStepTitle(to);
  const remoteTarget = usesRemoteNode(path);

  if (toTitle === "应用层门") {
    if (state.request === "local") {
      return "先被 NO_PROXY / loopback 截住";
    }

    if (state.request === "cli") {
      return state.clash === "skip"
        ? "没有环境变量代理"
        : "HTTP_PROXY / HTTPS_PROXY -> 7897";
    }

    if (goesDirectlyToClash(state)) {
      return "系统代理 -> 7897";
    }

    if (state.bifrost === "off") {
      return "系统代理不指向 8899 / 7897";
    }

    return "系统代理 -> 8899";
  }

  if (fromTitle === "应用层门") {
    if (toTitle.startsWith("Bifrost")) {
      return "8899 接住请求";
    }

    if (toTitle.startsWith("Clash")) {
      return "7897 接住请求";
    }

    if (toTitle.startsWith("网络层门")) {
      return "应用层未改写下一跳";
    }

    return "本机入口失败";
  }

  if (fromTitle.startsWith("Bifrost")) {
    if (toTitle.startsWith("Clash")) {
      return "显式上游转发 -> 7897";
    }

    if (toTitle.startsWith("网络层门")) {
      return "DIRECT，交回系统路由";
    }

    return "转发失败";
  }

  if (fromTitle.startsWith("Clash")) {
    if (toTitle.startsWith("网络层门")) {
      return state.clash === "node"
        ? "节点命中，下一跳变成节点 IP"
        : "DIRECT，原目标交回路由";
    }

    return "入口状态决定是否继续";
  }

  if (fromTitle.startsWith("网络层门")) {
    if (fromTitle === "网络层门 / loopback") {
      return "lo0 本机闭环";
    }

    if (toTitle === "飞连网关") {
      return "utunX 隧道";
    }

    if (toTitle === "远端代理节点") {
      return state.feilian === "global"
        ? "本机到节点这段可经 utunX"
        : "本机只连代理节点";
    }

    if (toTitle.includes("不可达") || toTitle === "没有飞连网关") {
      return "没有可用出口";
    }

    return remoteTarget ? "代理节点之外不归本机路由" : "en0 / utunX 出口";
  }

  if (fromTitle === "飞连网关") {
    if (toTitle === "远端代理节点") {
      return "网关继续连代理节点";
    }

    if (state.request === "intranet") {
      return "网关转入企业网络";
    }

    return "网关继续连原目标";
  }

  if (fromTitle === "远端代理节点") {
    return state.request === "intranet"
      ? "远端无法访问公司网段"
      : "节点再用自己的网络访问目标";
  }

  return "继续下一跳";
}

function syncPathAnnotations(state: RequestState, path: HTMLElement) {
  const steps = Array.from(path.querySelectorAll<HTMLElement>(STEP_SELECTOR));

  steps.forEach((step, index) => {
    const small = step.querySelector("small");

    if (small) {
      small.textContent = stepBody(state, path, step);
    }

    let hop = step.querySelector<HTMLElement>(".rg-hop");

    if (index === steps.length - 1) {
      hop?.remove();
      return;
    }

    if (!hop) {
      hop = document.createElement("span");
      hop.className = "rg-hop";
      step.append(hop);
    }

    hop.textContent = hopLabel(state, path, index);
    hop.classList.toggle("warn", step.classList.contains("fail"));
    hop.classList.toggle(
      "gold",
      step.classList.contains("remote") || step.classList.contains("target")
    );
    hop.classList.toggle(
      "green",
      step.classList.contains("route") || step.classList.contains("loop")
    );
  });
}

function feilianCopy(state: RequestState, path: HTMLElement): CopyCard {
  const titles = getStepTitles(path);
  const hasGateway = titles.includes("飞连网关");
  const hasRemote = titles.includes("远端代理节点");
  const stoppedAtAppLayer = titles.some(
    (title) => title === "Clash 关闭" || title === "Clash 未进入"
  );

  if (state.request === "local") {
    return {
      title: "网络层 / 飞连：本机闭环",
      body: "localhost 走 lo0，本机闭环不经过 en0、utunX、飞连网关或远端代理节点。",
      tone: "green",
    };
  }

  if (stoppedAtAppLayer) {
    return {
      title: "网络层 / 飞连：尚未到达",
      body: "请求停在应用层代理入口或矛盾配置处，还没有进入 en0 / utunX 的网络层判断。",
      tone: "green",
    };
  }

  if (state.request === "intranet" && state.feilian === "off") {
    return {
      title: "网络层 / 飞连：缺少企业隧道",
      body: "飞连关闭时没有 utunX 到飞连网关这段企业隧道，公司内网通常不可达。",
      tone: "warn",
    };
  }

  if (hasGateway && state.request === "intranet") {
    return {
      title: "网络层 / 飞连：utunX 到企业网关",
      body: "网络层门命中公司网段，先进入 utunX；飞连客户端把内层目标送到飞连网关，网关再转进公司内网。",
      tone: "green",
    };
  }

  if (state.request === "intranet" && hasRemote) {
    return {
      title: "网络层 / 飞连：内网被送往远端节点",
      body: "这时网络层是在连接 Clash 选出的远端代理节点，而不是把内网目标交给飞连网关；远端节点通常访问不到公司内网。",
      tone: "warn",
    };
  }

  if (hasGateway && hasRemote) {
    return {
      title: "网络层 / 飞连：先到飞连网关，再连代理节点",
      body: "飞连全局包住本机到远端代理节点这段连接；网关之后仍继续连原本的远端节点，最终目标不会变成飞连。",
      tone: "green",
    };
  }

  if (hasGateway) {
    return {
      title: "网络层 / 飞连：全局外联",
      body: "网络层门先把目标 IP 交给 utunX；飞连客户端把内层目标送到飞连网关，网关再继续访问原目标。",
      tone: "green",
    };
  }

  if (state.feilian === "global") {
    return {
      title: "网络层 / 飞连：全局模式",
      body: "应用层路径确定后，真实外联会先进入 utunX，再由飞连客户端送到飞连网关；但这不改变 Bifrost 或 Clash 的应用层规则。",
      tone: "green",
    };
  }

  if (state.feilian === "speed") {
    return {
      title: "网络层 / 飞连：极速模式",
      body: "极速模式按目标覆盖路由判断：公司网段进 utunX，普通外网可能仍从 en0 出去。",
      tone: "green",
    };
  }

  return {
    title: "网络层 / 飞连：关闭",
    body: "飞连关闭时没有企业隧道；普通公网从 en0 出去，公司内网通常不可达。",
    tone: "green",
  };
}

function buildNarrative(state: RequestState, path: HTMLElement) {
  const parts: string[] = [];
  const titles = getStepTitles(path);
  const stoppedAtAppLayer = titles.some(
    (title) => title === "Clash 关闭" || title === "Clash 未进入"
  );

  if (state.request === "browser") {
    parts.push("浏览器发起普通外网请求，第一步先看 macOS 系统代理。");
  } else if (state.request === "claude") {
    parts.push("浏览器发起 Claude 域名请求，仍然先看 macOS 系统代理。");
  } else if (state.request === "cli") {
    parts.push(
      "Claude Code CLI 发起请求，它不自动吃系统代理，而是看 HTTP_PROXY / HTTPS_PROXY。"
    );
  } else if (state.request === "local") {
    parts.push("目标是 localhost，本机地址在应用层门先被 NO_PROXY 截住。");
  } else {
    parts.push("浏览器发起公司内网请求，先经过应用层门，再交给网络层门。");
  }

  if (state.request === "cli") {
    parts.push("Bifrost 的系统代理配置通常影响不到这条 CLI 请求。");
  } else if (state.request === "local") {
    parts.push("请求走 lo0 本机闭环，不应该绕进 Bifrost 或 Clash。");
  } else if (state.bifrost === "off") {
    if (state.clash === "skip") {
      parts.push("当前 Bifrost 关闭，并且 Clash 未进入，所以应用层没有本机代理入口。");
    } else {
      parts.push("当前 Bifrost 关闭只表示 8899 不参与；这组选择把应用层第一跳直接交给 7897。");
    }
  } else if (state.bifrost === "direct") {
    parts.push("当前请求进入 8899，但 Bifrost 选择 DIRECT，不转给 Clash。");
  } else {
    parts.push("当前 Bifrost 串联 Clash，请求会从 8899 转到 7897。");
  }

  if (pathHasClass(path, "clash")) {
    if (state.clash === "direct") {
      parts.push("Clash / Mihomo 收到请求后选择 DIRECT。");
    } else if (state.clash === "node") {
      parts.push("Clash / Mihomo 收到请求后命中远端代理节点。");
    }
  } else if (titles.some((title) => title.startsWith("Clash "))) {
    parts.push("路径走到 Clash 入口处，但当前 Clash 状态导致请求失败或矛盾。");
  } else if (state.clash !== "skip" && state.request !== "local") {
    parts.push(`你选择了 Clash ${clashLabel[state.clash]}，但这条路径没有到达 7897。`);
  }

  if (stoppedAtAppLayer) {
    parts.push("请求停在应用层，还没有进入 en0 / utunX 的网络层判断。");
  } else if (titles.includes("飞连网关")) {
    parts.push("最后网络层门进入 utunX，再经飞连网关继续到原本的下一跳。");
  } else if (state.request === "local") {
    parts.push("网络层门选择 lo0，本机服务直接可达。");
  } else {
    parts.push("最后仍由网络层门决定从 en0、utunX 或失败分支离开本机。");
  }

  return parts.join("");
}

function buildProxyNotice(state: RequestState, path: HTMLElement): CopyCard {
  const titles = getStepTitles(path);
  const reachesClash =
    pathHasClass(path, "clash") ||
    titles.some((title) => title === "Clash 关闭" || title === "Clash 未进入");
  const usesRemote = titles.includes("远端代理节点");

  let systemProxy = "";

  if (state.request === "cli") {
    systemProxy =
      "macOS 系统代理通常不参与；CLI 若进代理，是 HTTP_PROXY / HTTPS_PROXY 指向 127.0.0.1:7897。";
  } else if (state.request === "local") {
    systemProxy =
      "macOS 系统代理被 NO_PROXY / loopback 跳过，本机地址留在 lo0。";
  } else if (goesDirectlyToClash(state)) {
    systemProxy =
      "macOS 系统代理：HTTP / HTTPS 直接交给 127.0.0.1:7897，也就是 Clash / Mihomo；Bifrost 8899 不参与。";
  } else if (state.bifrost === "off") {
    systemProxy = "macOS 系统代理没有交给 Bifrost，也没有交给 Clash；这条请求不进 8899 / 7897。";
  } else {
    systemProxy = "macOS 系统代理：HTTP / HTTPS 先交给 127.0.0.1:8899，也就是 Bifrost。";
  }

  let remoteProxy = "";

  if (usesRemote && state.request === "intranet") {
    remoteProxy = "远端代理节点：被错误命中；公司内网不应该交给这个节点。";
  } else if (usesRemote) {
    remoteProxy = "远端代理节点：英国节点 / Clash 规则组选中的出口，最终目标看到它的 IP。";
  } else if (reachesClash && state.clash === "direct") {
    remoteProxy = "远端代理节点：未使用；Clash 进入了，但规则选择 DIRECT。";
  } else if (reachesClash && state.clash === "off") {
    remoteProxy = "远端代理节点：未使用；请求停在 7897 关闭处。";
  } else {
    remoteProxy = "远端代理节点：未使用；这条路径没有命中 Clash 节点。";
  }

  return {
    title: "当前代理入口 / 出口",
    body: `${systemProxy} ${remoteProxy}`,
    tone: usesRemote ? "gold" : undefined,
  };
}

function buildIssueNotice(state: RequestState, path: HTMLElement): CopyCard {
  const titles = getStepTitles(path);
  const hasClashStep =
    pathHasClass(path, "clash") ||
    titles.some((title) => title.startsWith("Clash "));

  if (state.request === "local") {
    return {
      title: "本机地址优先级最高",
      body: "localhost / 127.0.0.1 / ::1 应该被留在本机闭环。Bifrost、Clash、飞连开关在这条路径里只是背景。",
      tone: "green",
    };
  }

  if (!hasClashStep && state.clash !== "skip") {
    return {
      title: "Clash 选择未生效",
      body: `你选了 Clash ${clashLabel[state.clash]}，但应用层没有把请求送到 7897，所以路径上不会出现 Clash Verge。`,
      tone: "gold",
    };
  }

  if (titles.includes("Clash 关闭")) {
    return {
      title: "失败点在 7897",
      body: "这条路径已经把请求送到 Clash 入口，但 127.0.0.1:7897 没有监听，所以请求会停在本机代理入口。",
      tone: "warn",
    };
  }

  if (state.bifrost === "chain" && state.clash === "skip") {
    return {
      title: "当前组合不自洽",
      body: "Bifrost 串联 Clash 表示它要转给 7897；同时选择 Clash 未进入，不能代表一条真实链路。",
      tone: "warn",
    };
  }

  if (state.request === "intranet" && state.feilian === "off") {
    return {
      title: "内网缺少飞连网关",
      body: "公司内网依赖飞连隧道。飞连关闭时，即使应用层代理规则写对，也通常到不了公司内网。",
      tone: "warn",
    };
  }

  if (state.request === "intranet" && state.clash === "node" && hasClashStep) {
    return {
      title: "内网不该命中远端节点",
      body: "把公司内网目标交给远端代理节点通常会失败，也会把本应走企业隧道的访问意图送出本机代理链路。",
      tone: "warn",
    };
  }

  return {
    title: "当前状态自洽",
    body: "路径只画真正经过的节点。某个开关没出现在路径上，表示它在这条请求里没有被触发。",
    tone: "green",
  };
}

function setupFigure(figure: HTMLElement) {
  const nextButton = figure.querySelector<HTMLButtonElement>("[data-rg-next]");
  const prevButton = figure.querySelector<HTMLButtonElement>("[data-rg-prev]");
  const meter = figure.querySelector<HTMLElement>("[data-rg-meter]");
  const panels = Array.from(
    figure.querySelectorAll<HTMLElement>(SIDE_PANEL_SELECTOR)
  );
  const paths = Array.from(
    figure.querySelectorAll<HTMLElement>(PATH_SELECTOR)
  );
  const stateInputs = Array.from(
    figure.querySelectorAll<HTMLInputElement>(STATE_SELECTOR)
  );
  const stateLabels = Array.from(
    figure.querySelectorAll<HTMLLabelElement>("label[for]")
  );

  if (!nextButton || !prevButton || paths.length === 0) {
    return () => {};
  }

  let currentStep = 0;
  let scrollAnchor: { x: number; figureTop: number } | null = null;

  paths.forEach((path) => {
    path.querySelectorAll<HTMLElement>(STEP_SELECTOR).forEach((step) => {
      if (!getStepTitle(step).startsWith("网络层门")) {
        return;
      }

      step.classList.add("net-gate");

      if (!step.querySelector(".gate-leaves")) {
        const gateLeaves = document.createElement("span");

        gateLeaves.className = "gate-leaves";
        step.prepend(gateLeaves);
      }
    });
  });

  const rememberScroll = () => {
    scrollAnchor = {
      x: window.scrollX,
      figureTop: figure.getBoundingClientRect().top,
    };
  };

  const restoreScroll = () => {
    const anchor = scrollAnchor;

    if (!anchor) {
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const nextTop = figure.getBoundingClientRect().top;

        window.scrollTo(anchor.x, window.scrollY + nextTop - anchor.figureTop);
        scrollAnchor = null;
      });
    });
  };

  const renderCard = (panel: HTMLElement, card: CopyCard) => {
    const title = document.createElement("b");
    const body = document.createElement("small");

    title.textContent = card.title;
    body.textContent = card.body;
    panel.className = ["rg-panel", card.tone].filter(Boolean).join(" ");
    panel.replaceChildren(title, body);
  };

  const updateDynamicCopy = (path: HTMLElement) => {
    const state = getRequestState(figure);

    const panelCards = [
      requestCopy(state),
      bifrostCopy(state),
      clashCopy(state, path),
      feilianCopy(state, path),
    ];

    panels.forEach((panel, index) => {
      const card = panelCards[index];

      if (card) {
        renderCard(panel, card);
      }
    });

    syncPathAnnotations(state, path);
  };

  const clearStepState = () => {
    paths.forEach((path) => {
      path.style.removeProperty("--runner-left");
      path
        .querySelectorAll<HTMLElement>(STEP_SELECTOR)
        .forEach((step) => step.classList.remove("is-current", "is-done"));
    });
  };

  const setStep = (nextStep: number) => {
    const path = getVisiblePath(figure);

    if (!path) {
      return;
    }

    syncGlobalGateway(getRequestState(figure), path);

    const steps = Array.from(
      path.querySelectorAll<HTMLElement>(STEP_SELECTOR)
    );

    if (steps.length === 0) {
      return;
    }

    clearStepState();

    currentStep = Math.max(0, Math.min(nextStep, steps.length - 1));
    figure.dataset.rgStep = String(currentStep);
    figure.classList.toggle("is-ended", currentStep === steps.length - 1);

    steps.forEach((step, index) => {
      step.classList.toggle("is-done", index < currentStep);
      step.classList.toggle("is-current", index === currentStep);
    });

    const runnerLeft = ((currentStep + 0.5) / steps.length) * 100;
    path.style.setProperty("--runner-left", `${runnerLeft.toFixed(2)}%`);

    if (meter) {
      meter.textContent = `第 ${currentStep + 1} / ${steps.length} 步：${getStepTitle(
        steps[currentStep]
      )}`;
    }

    updateDynamicCopy(path);

    const atStart = currentStep === 0;
    const atEnd = currentStep === steps.length - 1;

    prevButton.disabled = atStart;
    nextButton.disabled = atEnd;
    prevButton.setAttribute("aria-label", "后退一步");
    nextButton.setAttribute("aria-label", "前进一步");
  };

  const advance = () => {
    setStep(currentStep + 1);
  };

  const retreat = () => {
    setStep(currentStep - 1);
  };

  const resetAfterStateChange = () => {
    if (!scrollAnchor) {
      rememberScroll();
    }

    setStep(0);
    restoreScroll();
  };

  figure.classList.add("is-stepped");
  nextButton.addEventListener("click", advance);
  prevButton.addEventListener("click", retreat);
  stateInputs.forEach((input) =>
    input.addEventListener("change", resetAfterStateChange)
  );
  stateLabels.forEach((label) => {
    label.addEventListener("pointerdown", rememberScroll);
    label.addEventListener("keydown", rememberScroll);
  });
  setStep(0);

  return () => {
    nextButton.removeEventListener("click", advance);
    prevButton.removeEventListener("click", retreat);
    stateInputs.forEach((input) =>
      input.removeEventListener("change", resetAfterStateChange)
    );
    stateLabels.forEach((label) => {
      label.removeEventListener("pointerdown", rememberScroll);
      label.removeEventListener("keydown", rememberScroll);
    });
    clearStepState();
    figure.classList.remove("is-stepped", "is-ended");
  };
}

export function RequestGatesLab({
  articleContentId,
}: {
  articleContentId: string;
}) {
  useEffect(() => {
    const container = document.getElementById(articleContentId);

    if (!container) {
      return;
    }

    const cleanups = Array.from(
      container.querySelectorAll<HTMLElement>(FIGURE_SELECTOR)
    ).map(setupFigure);

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [articleContentId]);

  return null;
}
