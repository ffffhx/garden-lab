#!/usr/bin/env node

import { spawn } from "node:child_process";
import {
  createDecipheriv,
  createHash,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { homedir, hostname, tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const workspaceRoot = path.resolve(packageRoot, "../..");
const MAX_CAPTURE_CHARS = 512_000;
const VALID_MODES = new Set(["local", "hub", "worker"]);
const DEFAULT_PROMPT_PREAMBLE = [
  "你是由飞书机器人触发的 Codex。",
  "请在指定仓库中完成用户请求，保持改动范围克制。",
  "完成后用中文给出简洁、可直接转发到飞书的总结。",
].join("\n");

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  if (args.envFile) {
    loadDotEnv(args.envFile);
  }

  const config = readConfig(args);
  validateConfig(config);

  if (config.mode === "worker") {
    await runWorker(config);
    return;
  }

  const app = config.mode === "hub" ? createHubApp(config) : createLocalApp(config);
  const server = createServer((request, response) => {
    app.handle(request, response).catch((error) => {
      const status = error instanceof HttpError ? error.status : 500;
      if (error instanceof HttpError) {
        console.warn(`request rejected: ${status} ${error.message}`);
      } else {
        console.error(error.stack || error.message);
      }
      sendJson(response, status, {
        code: status,
        msg: status === 500 ? "internal error" : error.message,
      });
    });
  });

  server.listen(config.port, () => {
    console.log(`lark-codex-bot ${config.mode} listening on http://localhost:${config.port}`);
    console.log(`event callback path: ${config.eventPath}`);
    if (config.mode === "hub") {
      console.log(`worker claim path: ${config.workerPathPrefix}/tasks/claim`);
      console.log(`hub queue file: ${config.hubQueueFile}`);
    } else {
      console.log(`codex workdir: ${config.codexWorkdir}`);
    }
  });
}

function createLocalApp(config) {
  const seenEvents = new Map();
  const taskQueues = new Map();
  const tokenCache = {
    expiresAt: 0,
    tenantAccessToken: "",
  };

  async function handle(request, response) {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === config.healthPath) {
      sendJson(response, 200, {
        ok: true,
        mode: config.mode,
        eventPath: config.eventPath,
        codexWorkdir: config.codexWorkdir,
      });
      return;
    }

    if (request.method !== "POST" || url.pathname !== config.eventPath) {
      sendJson(response, 404, { code: 404, msg: "not found" });
      return;
    }

    const rawBody = await readRawBody(request, config.maxBodyBytes);
    const payload = parseAndVerifyLarkPayload(config, request.headers, rawBody);

    if (isUrlVerification(payload)) {
      verifyPayloadToken(config, payload);
      sendJson(response, 200, { challenge: payload.challenge });
      return;
    }

    verifyPayloadToken(config, payload);

    const eventType = payload.header?.event_type || payload.type;
    if (eventType !== "im.message.receive_v1") {
      sendJson(response, 200, { code: 0, msg: "ignored" });
      return;
    }

    const eventId = payload.header?.event_id || "";
    if (eventId && rememberEvent(seenEvents, eventId, config.dedupeTtlMs)) {
      sendJson(response, 200, { code: 0, msg: "duplicate ignored" });
      return;
    }

    const task = buildCodexTask(config, payload);
    sendJson(response, 200, { code: 0, msg: task ? "accepted" : "ignored" });

    if (!task) {
      return;
    }

    enqueueMessageTask(config, tokenCache, taskQueues, task);
  }

  return { handle };
}

function createHubApp(config) {
  const seenEvents = new Map();
  const tokenCache = {
    expiresAt: 0,
    tenantAccessToken: "",
  };

  async function handle(request, response) {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "GET" && url.pathname === config.healthPath) {
      const store = await readHubStore(config);
      sendJson(response, 200, {
        ok: true,
        mode: config.mode,
        eventPath: config.eventPath,
        queued: store.tasks.filter((task) => task.status === "queued").length,
        running: store.tasks.filter((task) => task.status === "running").length,
        completed: store.tasks.filter((task) => isTerminalTaskStatus(task.status)).length,
      });
      return;
    }

    if (url.pathname === `${config.workerPathPrefix}/tasks/claim`) {
      if (request.method !== "POST") {
        sendJson(response, 405, { code: 405, msg: "method not allowed" });
        return;
      }
      verifyWorkerAuth(config, request.headers);
      const body = await readJsonBody(request, config.maxBodyBytes, true);
      const workerId = String(body.workerId || config.workerId || "worker");
      const task = await claimHubTask(config, workerId);
      sendJson(response, 200, { ok: true, task });
      return;
    }

    const resultTaskId = matchWorkerResultPath(config, url.pathname);
    if (resultTaskId) {
      if (request.method !== "POST") {
        sendJson(response, 405, { code: 405, msg: "method not allowed" });
        return;
      }
      verifyWorkerAuth(config, request.headers);
      const result = await readJsonBody(request, config.maxBodyBytes, false);
      const hubTask = await recordHubTaskResult(config, resultTaskId, result);
      sendJson(response, 200, { ok: true, taskId: resultTaskId });
      replyHubTaskResult(config, tokenCache, hubTask).catch((error) => {
        console.error(`failed to send final Lark reply for task ${resultTaskId}: ${error.stack || error.message}`);
      });
      return;
    }

    if (url.pathname === `${config.workerPathPrefix}/tasks`) {
      verifyWorkerAuth(config, request.headers);
      const store = await readHubStore(config);
      sendJson(response, 200, {
        ok: true,
        tasks: store.tasks.slice(-config.hubListLimit).map(summarizeHubTask),
      });
      return;
    }

    if (request.method !== "POST" || url.pathname !== config.eventPath) {
      sendJson(response, 404, { code: 404, msg: "not found" });
      return;
    }

    const rawBody = await readRawBody(request, config.maxBodyBytes);
    const payload = parseAndVerifyLarkPayload(config, request.headers, rawBody);

    if (isUrlVerification(payload)) {
      verifyPayloadToken(config, payload);
      sendJson(response, 200, { challenge: payload.challenge });
      return;
    }

    verifyPayloadToken(config, payload);

    const eventType = payload.header?.event_type || payload.type;
    if (eventType !== "im.message.receive_v1") {
      sendJson(response, 200, { code: 0, msg: "ignored" });
      return;
    }

    const eventId = payload.header?.event_id || "";
    if (eventId && rememberEvent(seenEvents, eventId, config.dedupeTtlMs)) {
      sendJson(response, 200, { code: 0, msg: "duplicate ignored" });
      return;
    }

    const task = buildCodexTask(config, payload);
    if (!task) {
      sendJson(response, 200, { code: 0, msg: "ignored" });
      return;
    }

    if (task.replyOnly) {
      sendJson(response, 200, { code: 0, msg: "accepted" });
      await safeReply(config, tokenCache, task.messageId, task.replyOnly);
      return;
    }

    const hubTask = await enqueueHubTask(config, task);
    sendJson(response, 200, { code: 0, msg: "queued", task_id: hubTask.id });

    console.log(
      `queued ${hubTask.id} from ${task.senderOpenId} in ${task.chatId}: ${task.text.slice(0, 120)}`,
    );

    if (config.sendRunningMessage) {
      await safeReply(config, tokenCache, task.messageId, config.hubQueuedMessage);
    }
  }

  return { handle };
}

async function runWorker(config) {
  let stopping = false;
  process.once("SIGINT", () => {
    stopping = true;
  });
  process.once("SIGTERM", () => {
    stopping = true;
  });

  console.log(`lark-codex-bot worker started: ${config.workerId}`);
  console.log(`hub: ${config.hubBaseUrl}${config.workerPathPrefix}`);
  console.log(`codex workdir: ${config.codexWorkdir}`);

  while (!stopping) {
    try {
      const claimed = await claimRemoteTask(config);
      if (!claimed) {
        await sleep(config.workerPollIntervalMs);
        continue;
      }

      await processRemoteTask(config, claimed);
    } catch (error) {
      console.error(`worker loop failed: ${error.stack || error.message}`);
      await sleep(config.workerErrorRetryMs);
    }
  }

  console.log("lark-codex-bot worker stopped");
}

async function processRemoteTask(config, hubTask) {
  const task = hubTask.task;
  console.log(
    `claimed ${hubTask.id} from ${task.senderOpenId} in ${task.chatId}: ${task.text.slice(0, 120)}`,
  );

  const result = await runCodex(config, task);
  const text = result.ok
    ? result.output
    : `Codex 运行失败${result.timedOut ? "：任务超时" : ""}。\n\n${result.output}`;
  const replied = config.resultReplyMode === "worker"
    ? await safeReply(
      config,
      { expiresAt: 0, tenantAccessToken: "" },
      task.messageId,
      formatReplyText(config, redactSecrets(config, text), result.sessionId),
    )
    : false;

  await submitWorkerResultWithRetry(config, hubTask.id, {
    ok: result.ok,
    output: redactSecrets(config, result.output),
    replied,
    sessionId: result.sessionId,
    timedOut: result.timedOut,
    workerId: config.workerId,
  });
}

async function claimRemoteTask(config) {
  const data = await fetchJson(`${config.hubBaseUrl}${config.workerPathPrefix}/tasks/claim`, {
    method: "POST",
    headers: workerHeaders(config),
    body: JSON.stringify({
      workerId: config.workerId,
    }),
  });

  return data.task || null;
}

async function submitWorkerResultWithRetry(config, taskId, result) {
  while (true) {
    try {
      await fetchJson(`${config.hubBaseUrl}${config.workerPathPrefix}/tasks/${encodeURIComponent(taskId)}/result`, {
        method: "POST",
        headers: workerHeaders(config),
        body: JSON.stringify(result),
      });
      return;
    } catch (error) {
      console.error(`submit result failed for ${taskId}: ${error.message}`);
      await sleep(config.workerSubmitRetryMs);
    }
  }
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? tryParseJson(text) : null;

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${text || response.statusText}`);
  }

  if (!data) {
    throw new Error(`invalid json response from ${url}`);
  }

  return data;
}

function workerHeaders(config) {
  return {
    Authorization: `Bearer ${config.hubWorkerToken}`,
    "Content-Type": "application/json; charset=utf-8",
  };
}

async function enqueueHubTask(config, task) {
  const now = new Date().toISOString();
  const store = await readHubStore(config);
  const hubTask = {
    attempts: 0,
    createdAt: now,
    id: randomUUID(),
    result: null,
    status: "queued",
    task,
    updatedAt: now,
    workerId: "",
  };

  store.tasks.push(hubTask);
  pruneHubStore(config, store);
  await writeHubStore(config, store);
  return hubTask;
}

async function claimHubTask(config, workerId) {
  const store = await readHubStore(config);
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  let changed = false;

  for (const task of store.tasks) {
    if (
      task.status === "running" &&
      task.leaseExpiresAt &&
      Date.parse(task.leaseExpiresAt) <= nowMs
    ) {
      task.status = "queued";
      task.updatedAt = now;
      task.workerId = "";
      task.leaseExpiresAt = "";
      changed = true;
    }
  }

  const task = store.tasks.find((candidate) => candidate.status === "queued");
  if (!task) {
    if (changed) {
      await writeHubStore(config, store);
    }
    return null;
  }

  task.status = "running";
  task.attempts = Number(task.attempts || 0) + 1;
  task.workerId = workerId;
  task.claimedAt = now;
  task.updatedAt = now;
  task.leaseExpiresAt = new Date(nowMs + config.hubTaskLeaseMs).toISOString();
  await writeHubStore(config, store);

  return {
    attempts: task.attempts,
    id: task.id,
    task: task.task,
  };
}

async function recordHubTaskResult(config, taskId, result) {
  const store = await readHubStore(config);
  const task = store.tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw new HttpError(404, `task not found: ${taskId}`);
  }

  const now = new Date().toISOString();
  task.status = result.ok ? "done" : "failed";
  task.completedAt = now;
  task.updatedAt = now;
  task.leaseExpiresAt = "";
  task.result = {
    ok: Boolean(result.ok),
    output: String(result.output || ""),
    replied: Boolean(result.replied),
    sessionId: String(result.sessionId || ""),
    timedOut: Boolean(result.timedOut),
    workerId: String(result.workerId || task.workerId || ""),
  };

  await writeHubStore(config, store);
  return task;
}

async function markHubTaskReplied(config, taskId) {
  const store = await readHubStore(config);
  const task = store.tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    return;
  }

  task.repliedAt = new Date().toISOString();
  task.updatedAt = task.repliedAt;
  await writeHubStore(config, store);
}

async function replyHubTaskResult(config, tokenCache, hubTask) {
  if (hubTask.repliedAt || hubTask.result?.replied || config.resultReplyMode !== "hub") {
    return;
  }

  const result = hubTask.result || {};
  const text = result.ok
    ? result.output
    : `Codex 运行失败${result.timedOut ? "：任务超时" : ""}。\n\n${result.output}`;

  const replied = await safeReply(
    config,
    tokenCache,
    hubTask.task.messageId,
    formatReplyText(config, redactSecrets(config, text), result.sessionId),
  );
  if (replied) {
    await markHubTaskReplied(config, hubTask.id);
  }
}

async function readHubStore(config) {
  try {
    const parsed = JSON.parse(await readFile(config.hubQueueFile, "utf8"));
    return {
      version: 1,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    return {
      version: 1,
      tasks: [],
    };
  }
}

async function writeHubStore(config, store) {
  await mkdir(path.dirname(config.hubQueueFile), { recursive: true });
  await writeFile(config.hubQueueFile, `${JSON.stringify(store, null, 2)}\n`, {
    mode: 0o600,
  });
}

function pruneHubStore(config, store) {
  if (store.tasks.length <= config.hubMaxTasks) {
    return;
  }

  const active = store.tasks.filter((task) => !isTerminalTaskStatus(task.status));
  const terminal = store.tasks.filter((task) => isTerminalTaskStatus(task.status));
  const remainingSlots = Math.max(0, config.hubMaxTasks - active.length);
  store.tasks = [...active, ...terminal.slice(-remainingSlots)];
}

function summarizeHubTask(task) {
  return {
    attempts: task.attempts || 0,
    chatId: task.task?.chatId || "",
    completedAt: task.completedAt || "",
    createdAt: task.createdAt || "",
    id: task.id,
    messageId: task.task?.messageId || "",
    status: task.status,
    text: task.task?.text ? task.task.text.slice(0, 160) : "",
    updatedAt: task.updatedAt || "",
    workerId: task.workerId || task.result?.workerId || "",
  };
}

function isTerminalTaskStatus(status) {
  return status === "done" || status === "failed";
}

function matchWorkerResultPath(config, pathname) {
  const prefix = escapeRegExp(config.workerPathPrefix);
  const match = new RegExp(`^${prefix}/tasks/([^/]+)/result$`).exec(pathname);
  return match ? decodeURIComponent(match[1]) : "";
}

function parseAndVerifyLarkPayload(config, headers, rawBody) {
  const rawText = rawBody.toString("utf8");
  const envelope = parseJson(rawText, "invalid json body");
  const hasSignature = Boolean(headers["x-lark-signature"]);

  if (envelope.encrypt) {
    if (!config.encryptKey) {
      throw new HttpError(401, "encrypted payload requires LARK_ENCRYPT_KEY");
    }
    if (hasSignature) {
      verifyLarkSignature(config, headers, rawText);
    }

    const payload = parseJson(
      decryptLarkPayload(config.encryptKey, envelope.encrypt),
      "invalid decrypted json body",
    );

    if (!hasSignature && !isUrlVerification(payload)) {
      throw new HttpError(401, "missing Lark signature");
    }

    return payload;
  }

  if (config.encryptKey && !isUrlVerification(envelope)) {
    verifyLarkSignature(config, headers, rawText);
  }

  return envelope;
}

function verifyLarkSignature(config, headers, rawText) {
  const timestamp = readRequiredHeader(headers, "x-lark-request-timestamp");
  const nonce = readRequiredHeader(headers, "x-lark-request-nonce");
  const actual = readRequiredHeader(headers, "x-lark-signature");

  if (config.signatureMaxAgeSeconds > 0) {
    const requestSeconds = Number(timestamp);
    const currentSeconds = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(requestSeconds)) {
      throw new HttpError(401, "invalid Lark timestamp");
    }
    if (Math.abs(currentSeconds - requestSeconds) > config.signatureMaxAgeSeconds) {
      throw new HttpError(401, "stale Lark signature");
    }
  }

  const expected = createHash("sha256")
    .update(timestamp + nonce + config.encryptKey + rawText)
    .digest("hex");

  if (!safeEqualHex(expected, actual)) {
    throw new HttpError(401, "invalid Lark signature");
  }
}

function decryptLarkPayload(encryptKey, encryptedText) {
  const encrypted = Buffer.from(encryptedText, "base64");
  if (encrypted.length <= 16) {
    throw new HttpError(400, "invalid encrypted payload");
  }

  const key = createHash("sha256").update(encryptKey, "utf8").digest();
  const iv = encrypted.subarray(0, 16);
  const ciphertext = encrypted.subarray(16);
  const decipher = createDecipheriv("aes-256-cbc", key, iv);
  decipher.setAutoPadding(false);

  const padded = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const padLength = padded[padded.length - 1];
  if (padLength < 1 || padLength > 16) {
    throw new HttpError(400, "invalid encrypted payload padding");
  }

  return padded.subarray(0, padded.length - padLength).toString("utf8");
}

function verifyPayloadToken(config, payload) {
  if (!config.verificationToken) {
    return;
  }

  const token = payload.header?.token || payload.token;
  if (!token || token !== config.verificationToken) {
    throw new HttpError(401, "invalid verification token");
  }
}

function verifyWorkerAuth(config, headers) {
  const authorization = readOptionalHeader(headers, "authorization");
  const bearer = authorization.match(/^Bearer\s+(.+)$/i)?.[1] || "";
  const headerToken = readOptionalHeader(headers, "x-lark-codex-worker-token");
  const token = bearer || headerToken;

  if (!token || !safeEqualText(token, config.hubWorkerToken)) {
    throw new HttpError(401, "invalid worker token");
  }
}

function buildCodexTask(config, payload) {
  const event = payload.event || {};
  const sender = event.sender || {};
  const message = event.message || {};
  const messageId = message.message_id || "";
  const chatId = message.chat_id || "";
  const senderOpenId = sender.sender_id?.open_id || "";
  const senderType = sender.sender_type || "";
  const chatType = message.chat_type || "";
  const messageType = message.message_type || "";

  if (!messageId || senderType !== "user") {
    return null;
  }

  if (config.allowedChatIds.length > 0 && !config.allowedChatIds.includes(chatId)) {
    console.log(`ignored message from unapproved chat ${chatId || "(unknown)"}`);
    return null;
  }

  if (
    config.allowedUserOpenIds.length > 0 &&
    !config.allowedUserOpenIds.includes(senderOpenId)
  ) {
    console.log(`ignored message from unapproved user ${senderOpenId || "(unknown)"}`);
    return null;
  }

  if (messageType !== "text" && messageType !== "post") {
    return {
      accepted: false,
      eventId: payload.header?.event_id || "",
      messageId,
      replyOnly: `暂时只支持文本消息，当前消息类型是 ${messageType || "unknown"}。`,
    };
  }

  const mentions = Array.isArray(message.mentions) ? message.mentions : [];
  if (isGroupChat(chatType) && !config.acceptGroupWithoutMention) {
    const mentioned = mentions.some((mention) => matchesBotMention(config, mention));
    if (!mentioned) {
      return null;
    }
  }

  let text = extractMessageText(message);
  text = stripMentions(text, mentions).trim();

  if (config.commandPrefix) {
    if (!text.startsWith(config.commandPrefix)) {
      return null;
    }
    text = text.slice(config.commandPrefix.length).trim();
  }

  if (!text) {
    return {
      accepted: false,
      eventId: payload.header?.event_id || "",
      messageId,
      replyOnly: "我收到了，但没有识别到要交给 Codex 的具体任务。",
    };
  }

  return {
    accepted: true,
    chatId,
    chatType,
    eventId: payload.header?.event_id || "",
    messageId,
    senderOpenId,
    text,
  };
}

async function processMessageTask(config, tokenCache, task) {
  if (task.replyOnly) {
    await safeReply(config, tokenCache, task.messageId, task.replyOnly);
    return;
  }

  console.log(
    `accepted ${task.eventId || randomUUID()} from ${task.senderOpenId} in ${task.chatId}: ${task.text.slice(0, 120)}`,
  );

  if (config.sendRunningMessage) {
    await safeReply(config, tokenCache, task.messageId, "收到，Codex 开始处理。");
  }

  const result = await runCodex(config, task);
  const text = result.ok
    ? result.output
    : `Codex 运行失败${result.timedOut ? "：任务超时" : ""}。\n\n${result.output}`;

  await safeReply(
    config,
    tokenCache,
    task.messageId,
    formatReplyText(config, redactSecrets(config, text), result.sessionId),
  );
}

function enqueueMessageTask(config, tokenCache, taskQueues, task) {
  const queueKey = getTaskQueueKey(task);
  const previous = taskQueues.get(queueKey) || Promise.resolve();
  const next = previous
    .catch((error) => {
      console.error(`previous task failed in queue ${queueKey}: ${error.stack || error.message}`);
    })
    .then(() => processMessageTask(config, tokenCache, task))
    .finally(() => {
      if (taskQueues.get(queueKey) === next) {
        taskQueues.delete(queueKey);
      }
    });

  taskQueues.set(queueKey, next);
  next.catch((error) => {
    console.error(error.stack || error.message);
  });
}

function getTaskQueueKey(task) {
  return task.chatId || task.senderOpenId || "unknown";
}

async function runCodex(config, task) {
  const startedAtMs = Date.now();
  const tempDir = await mkdtemp(path.join(tmpdir(), "lark-codex-"));
  const outputFile = path.join(tempDir, "last-message.txt");
  const reusableSession = await getReusableSession(config, task);
  const args = buildCodexArgs(config, outputFile, reusableSession?.sessionId || "");

  const prompt = [
    config.codexPromptPreamble || DEFAULT_PROMPT_PREAMBLE,
    "",
    "飞书用户请求：",
    task.text,
    "",
    "飞书事件上下文：",
    `- chat_type: ${task.chatType || "unknown"}`,
    `- chat_id: ${task.chatId || "unknown"}`,
    `- message_id: ${task.messageId}`,
    `- sender_open_id: ${task.senderOpenId || "unknown"}`,
  ].join("\n");

  let stdout = "";
  let stderr = "";
  let timedOut = false;

  try {
    const child = spawn(config.codexBin, args, {
      cwd: config.codexWorkdir,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    console.log(
      `codex child pid: ${child.pid || "unknown"} for message ${task.messageId}` +
        (reusableSession?.sessionId ? ` (resume ${reusableSession.sessionId})` : " (new session)"),
    );

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5_000).unref();
    }, config.codexTimeoutMs);
    timeout.unref();

    child.stdout.on("data", (chunk) => {
      stdout = appendLimited(stdout, chunk.toString("utf8"), MAX_CAPTURE_CHARS);
    });
    child.stderr.on("data", (chunk) => {
      stderr = appendLimited(stderr, chunk.toString("utf8"), MAX_CAPTURE_CHARS);
    });

    child.stdin.end(prompt);

    const code = await new Promise((resolve, reject) => {
      child.on("error", reject);
      child.on("close", resolve);
    });
    clearTimeout(timeout);

    const lastMessage = await readMaybe(outputFile);
    const fallback = lastMessage || [stdout, stderr].filter(Boolean).join("\n\n").trim();
    const session = await findLatestCodexSession(config, startedAtMs);
    const sessionId = session?.id || reusableSession?.sessionId || "";
    if (session) {
      console.log(`codex session id: ${session.id}`);
      console.log(`codex session file: ${session.filePath}`);
      await rememberChatSession(config, task, session);
    } else if (reusableSession?.sessionId) {
      console.log(`codex session id: ${reusableSession.sessionId}`);
    } else {
      console.warn(`codex session id not found for message ${task.messageId}`);
    }

    return {
      ok: code === 0 && !timedOut,
      timedOut,
      output: limitText(fallback || `codex exited with code ${code}`, config.maxOutputChars),
      sessionId,
    };
  } catch (error) {
    const session = await findLatestCodexSession(config, startedAtMs).catch(() => null);
    if (session) {
      await rememberChatSession(config, task, session).catch(() => {});
    }
    return {
      ok: false,
      timedOut,
      output: limitText(`${error.stack || error.message}\n\n${stdout}\n${stderr}`.trim(), config.maxOutputChars),
      sessionId: session?.id || "",
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true }).catch(() => {});
  }
}

function buildCodexArgs(config, outputFile, sessionId) {
  if (sessionId) {
    const args = [
      "exec",
      "resume",
      "--output-last-message",
      outputFile,
    ];

    if (config.codexModel) {
      args.push("--model", config.codexModel);
    }
    args.push(sessionId, "-");
    return args;
  }

  const args = [
    "exec",
    "--cd",
    config.codexWorkdir,
    "--sandbox",
    config.codexSandbox,
    "--color",
    "never",
    "--output-last-message",
    outputFile,
  ];

  if (config.codexModel) {
    args.push("--model", config.codexModel);
  }
  if (config.codexProfile) {
    args.push("--profile", config.codexProfile);
  }
  if (config.codexEnableWebSearch) {
    args.push("--search");
  }
  if (config.codexEphemeral) {
    args.push("--ephemeral");
  }
  args.push("-");
  return args;
}

function formatReplyText(config, text, sessionId) {
  if (!config.includeCodexSession || !sessionId) {
    return limitText(text, config.maxOutputChars);
  }

  const hint = [
    `Codex session: ${sessionId}`,
    `CLI 恢复: codex resume --include-non-interactive ${sessionId}`,
  ].join("\n");
  const bodyMaxChars = Math.max(500, config.maxOutputChars - hint.length - 8);

  return `${limitText(text, bodyMaxChars).trimEnd()}\n\n---\n${hint}`;
}

async function getReusableSession(config, task) {
  if (config.codexSessionScope !== "chat" || config.codexEphemeral) {
    return null;
  }

  const key = getTaskQueueKey(task);
  const store = await readSessionStore(config);
  const session = store.chats?.[key];
  if (!session?.sessionId) {
    return null;
  }
  if (session.filePath && !existsSync(session.filePath)) {
    delete store.chats[key];
    await writeSessionStore(config, store);
    return null;
  }

  return session;
}

async function rememberChatSession(config, task, session) {
  if (config.codexSessionScope !== "chat" || config.codexEphemeral || !session?.id) {
    return;
  }

  const key = getTaskQueueKey(task);
  const store = await readSessionStore(config);
  store.chats[key] = {
    chatId: task.chatId || "",
    chatType: task.chatType || "",
    filePath: session.filePath || "",
    sessionId: session.id,
    updatedAt: new Date().toISOString(),
  };
  await writeSessionStore(config, store);
}

async function readSessionStore(config) {
  try {
    const parsed = JSON.parse(await readFile(config.codexSessionStorePath, "utf8"));
    return {
      version: 1,
      chats: parsed.chats && typeof parsed.chats === "object" ? parsed.chats : {},
    };
  } catch {
    return {
      version: 1,
      chats: {},
    };
  }
}

async function writeSessionStore(config, store) {
  await mkdir(path.dirname(config.codexSessionStorePath), { recursive: true });
  await writeFile(config.codexSessionStorePath, `${JSON.stringify(store, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function findLatestCodexSession(config, startedAtMs) {
  if (config.codexEphemeral) {
    return null;
  }

  const sessionsDir = path.join(config.codexHome, "sessions");
  const files = await collectRecentSessionFiles(sessionsDir, startedAtMs - 10_000);
  files.sort((left, right) => right.mtimeMs - left.mtimeMs);

  for (const file of files) {
    const meta = await readSessionMeta(file.filePath);
    const payload = meta?.payload || {};
    const id = payload.id || parseSessionId(file.filePath);
    const timestampMs = Date.parse(payload.timestamp || meta?.timestamp || "");

    if (!id) {
      continue;
    }
    if (payload.cwd && path.resolve(payload.cwd) !== path.resolve(config.codexWorkdir)) {
      continue;
    }
    if (payload.source && payload.source !== "exec") {
      continue;
    }
    if (Number.isFinite(timestampMs) && timestampMs < startedAtMs - 10_000) {
      continue;
    }

    return {
      filePath: file.filePath,
      id,
    };
  }

  return null;
}

async function collectRecentSessionFiles(dir, minMtimeMs, collected = []) {
  let entries = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return collected;
  }

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectRecentSessionFiles(entryPath, minMtimeMs, collected);
      continue;
    }
    if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
      continue;
    }

    const fileStat = await stat(entryPath).catch(() => null);
    if (fileStat && fileStat.mtimeMs >= minMtimeMs) {
      collected.push({
        filePath: entryPath,
        mtimeMs: fileStat.mtimeMs,
      });
    }
  }

  return collected;
}

async function readSessionMeta(filePath) {
  const firstLine = (await readFile(filePath, "utf8")).split("\n").find(Boolean);
  if (!firstLine) {
    return null;
  }

  return tryParseJson(firstLine);
}

function parseSessionId(filePath) {
  return path.basename(filePath).match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/)?.[1] || "";
}

async function safeReply(config, tokenCache, messageId, text) {
  try {
    if (config.replyMode === "cli" || !config.appSecret) {
      await replyToMessageViaCli(config, messageId, text);
    } else {
      await replyToMessage(config, tokenCache, messageId, text);
    }
    return true;
  } catch (error) {
    console.error(`failed to reply to Lark message ${messageId}: ${error.message}`);
    return false;
  }
}

async function replyToMessageViaCli(config, messageId, text) {
  const args = [
    "im",
    "+messages-reply",
    "--as",
    "bot",
    "--message-id",
    messageId,
    "--text",
    text,
    "--idempotency-key",
    randomUUID(),
  ];

  if (config.replyInThread) {
    args.push("--reply-in-thread");
  }

  let stderr = "";
  const child = spawn(config.larkCliBin, args, {
    cwd: config.codexWorkdir,
    env: process.env,
    stdio: ["ignore", "ignore", "pipe"],
  });

  child.stderr.on("data", (chunk) => {
    stderr = appendLimited(stderr, chunk.toString("utf8"), 16_000);
  });

  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (code !== 0) {
    throw new Error(`lark-cli reply failed with code ${code}: ${stderr.trim()}`);
  }
}

async function replyToMessage(config, tokenCache, messageId, text) {
  if (!config.appId || !config.appSecret) {
    throw new Error("missing LARK_APP_ID or LARK_APP_SECRET");
  }

  const token = await getTenantAccessToken(config, tokenCache);
  const url = `${config.larkBaseUrl}/im/v1/messages/${encodeURIComponent(messageId)}/reply`;
  const body = {
    msg_type: "text",
    content: JSON.stringify({ text }),
  };

  if (config.replyInThread) {
    body.reply_in_thread = true;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code !== 0) {
    throw new Error(`Lark reply failed: HTTP ${response.status} ${JSON.stringify(data)}`);
  }
}

async function getTenantAccessToken(config, tokenCache) {
  if (tokenCache.tenantAccessToken && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.tenantAccessToken;
  }

  const response = await fetch(`${config.larkBaseUrl}/auth/v3/tenant_access_token/internal`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`tenant_access_token failed: HTTP ${response.status} ${JSON.stringify(data)}`);
  }

  const expireSeconds = Number(data.expire) || 7_200;
  tokenCache.tenantAccessToken = data.tenant_access_token;
  tokenCache.expiresAt = Date.now() + expireSeconds * 1000;
  return tokenCache.tenantAccessToken;
}

function extractMessageText(message) {
  const content = message.content || "";
  const parsed = tryParseJson(content);

  if (!parsed) {
    return content;
  }

  if (typeof parsed.text === "string") {
    return parsed.text;
  }

  const fragments = [];
  collectTextFragments(parsed, fragments);
  return fragments.join("\n");
}

function collectTextFragments(value, fragments) {
  if (!value) {
    return;
  }
  if (typeof value === "string") {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextFragments(item, fragments);
    }
    return;
  }
  if (typeof value !== "object") {
    return;
  }
  if (typeof value.text === "string") {
    fragments.push(value.text);
  }
  if (typeof value.un_escape === "string") {
    fragments.push(value.un_escape);
  }
  for (const child of Object.values(value)) {
    collectTextFragments(child, fragments);
  }
}

function stripMentions(text, mentions) {
  let stripped = text;
  for (const mention of mentions) {
    if (mention.key) {
      stripped = stripped.split(mention.key).join("");
    }
    if (mention.name) {
      stripped = stripped.replace(new RegExp(`@${escapeRegExp(mention.name)}\\b`, "g"), "");
    }
  }
  return stripped;
}

function matchesBotMention(config, mention) {
  const id = mention.id || {};
  if (config.botOpenId && id.open_id === config.botOpenId) {
    return true;
  }
  if (config.botUserId && id.user_id === config.botUserId) {
    return true;
  }
  if (config.botName && mention.name === config.botName) {
    return true;
  }
  if (!config.botOpenId && !config.botUserId && !config.botName) {
    return true;
  }
  return false;
}

function isGroupChat(chatType) {
  return chatType === "group" || chatType === "topic_group";
}

function isUrlVerification(payload) {
  return payload?.type === "url_verification" && typeof payload.challenge === "string";
}

function rememberEvent(seenEvents, eventId, ttlMs) {
  const now = Date.now();
  for (const [storedEventId, expiresAt] of seenEvents) {
    if (expiresAt <= now) {
      seenEvents.delete(storedEventId);
    }
  }
  if (seenEvents.has(eventId)) {
    return true;
  }
  seenEvents.set(eventId, now + ttlMs);
  return false;
}

async function readJsonBody(request, maxBytes, allowEmpty) {
  const rawBody = await readRawBody(request, maxBytes);
  const rawText = rawBody.toString("utf8").trim();
  if (!rawText && allowEmpty) {
    return {};
  }
  return parseJson(rawText, "invalid json body");
}

async function readRawBody(request, maxBytes) {
  const chunks = [];
  let total = 0;

  for await (const chunk of request) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new HttpError(413, "request body too large");
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function parseJson(text, message) {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, message);
  }
}

function tryParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function safeEqualHex(expected, actual) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function safeEqualText(expected, actual) {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  return (
    expectedBuffer.length === actualBuffer.length &&
    timingSafeEqual(expectedBuffer, actualBuffer)
  );
}

function readRequiredHeader(headers, name) {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  if (!value) {
    throw new HttpError(401, `missing ${name}`);
  }
  return value;
}

function readOptionalHeader(headers, name) {
  const value = headers[name];
  if (Array.isArray(value)) {
    return value[0] || "";
  }
  return value || "";
}

function limitText(text, maxChars) {
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars - 80)}\n\n[输出过长，已截断；请到 Codex 运行日志查看完整结果]`;
}

function appendLimited(text, addition, maxChars) {
  const combined = text + addition;
  if (combined.length <= maxChars) {
    return combined;
  }
  return combined.slice(combined.length - maxChars);
}

async function readMaybe(filePath) {
  try {
    return (await readFile(filePath, "utf8")).trim();
  } catch {
    return "";
  }
}

function redactSecrets(config, text) {
  let redacted = text;
  for (const secret of [
    config.appSecret,
    config.verificationToken,
    config.encryptKey,
    config.hubWorkerToken,
  ]) {
    if (secret && secret.length >= 8) {
      redacted = redacted.split(secret).join("[redacted]");
    }
  }
  return redacted
    .replace(/(tenant_access_token|access_token|app_secret)\s*[:=]\s*["']?[^"'\s]+/gi, "$1=[redacted]")
    .replace(/Authorization:\s*Bearer\s+[A-Za-z0-9._-]+/gi, "Authorization: Bearer [redacted]");
}

function readConfig(args) {
  const mode = args.mode || env("LARK_CODEX_MODE", "local");
  const workerPathPrefix = normalizePathPrefix(env("WORKER_PATH_PREFIX", "/worker"));

  return {
    acceptGroupWithoutMention: boolEnv("LARK_ACCEPT_GROUP_WITHOUT_MENTION", false),
    allowedChatIds: listEnv("LARK_ALLOWED_CHAT_IDS"),
    allowedUserOpenIds: listEnv("LARK_ALLOWED_USER_OPEN_IDS"),
    appId: env("LARK_APP_ID"),
    appSecret: env("LARK_APP_SECRET"),
    botName: env("LARK_BOT_NAME"),
    botOpenId: env("LARK_BOT_OPEN_ID"),
    botUserId: env("LARK_BOT_USER_ID"),
    codexBin: env("CODEX_BIN", "codex"),
    codexEnableWebSearch: boolEnv("CODEX_ENABLE_WEB_SEARCH", false),
    codexEphemeral: boolEnv("CODEX_EPHEMERAL", false),
    codexHome: path.resolve(env("CODEX_HOME", path.join(homedir(), ".codex"))),
    codexModel: env("CODEX_MODEL"),
    codexProfile: env("CODEX_PROFILE"),
    codexPromptPreamble: env("CODEX_PROMPT_PREAMBLE"),
    codexSandbox: env("CODEX_SANDBOX", "workspace-write"),
    codexSessionScope: env("CODEX_SESSION_SCOPE", "chat"),
    codexSessionStorePath: path.resolve(env("CODEX_SESSION_STORE", path.join(packageRoot, ".sessions.json"))),
    codexTimeoutMs: numberEnv("CODEX_TIMEOUT_MS", 600_000),
    codexWorkdir: path.resolve(env("CODEX_WORKDIR", workspaceRoot)),
    commandPrefix: env("BOT_COMMAND_PREFIX"),
    dedupeTtlMs: numberEnv("LARK_EVENT_DEDUPE_TTL_MS", 10 * 60_000),
    encryptKey: env("LARK_ENCRYPT_KEY"),
    eventPath: env("LARK_EVENT_PATH", "/lark/events"),
    healthPath: env("HEALTH_PATH", "/health"),
    hubBaseUrl: normalizeBaseUrl(env("HUB_BASE_URL")),
    hubListLimit: numberEnv("HUB_LIST_LIMIT", 50),
    hubMaxTasks: numberEnv("HUB_MAX_TASKS", 500),
    hubQueuedMessage: env("HUB_QUEUED_MESSAGE", "收到，任务已进入 Codex 队列，等待 Mac worker 处理。"),
    hubQueueFile: path.resolve(env("HUB_QUEUE_FILE", path.join(packageRoot, ".hub-queue.json"))),
    hubTaskLeaseMs: numberEnv("HUB_TASK_LEASE_MS", 30 * 60_000),
    hubWorkerToken: env("HUB_WORKER_TOKEN"),
    includeCodexSession: boolEnv("LARK_INCLUDE_CODEX_SESSION", true),
    larkBaseUrl: env("LARK_BASE_URL", "https://open.feishu.cn/open-apis").replace(/\/+$/, ""),
    larkCliBin: env("LARK_CLI_BIN", "lark-cli"),
    maxBodyBytes: numberEnv("MAX_BODY_BYTES", 1_000_000),
    maxOutputChars: numberEnv("CODEX_MAX_OUTPUT_CHARS", 6_000),
    mode,
    port: args.port || numberEnv("PORT", 8787),
    replyInThread: boolEnv("LARK_REPLY_IN_THREAD", false),
    replyMode: env("LARK_REPLY_MODE", mode === "hub" ? "openapi" : "cli"),
    resultReplyMode: env("RESULT_REPLY_MODE", "hub"),
    sendRunningMessage: boolEnv("LARK_SEND_RUNNING_MESSAGE", true),
    signatureMaxAgeSeconds: numberEnv("LARK_SIGNATURE_MAX_AGE_SECONDS", 10 * 60),
    verificationToken: env("LARK_VERIFICATION_TOKEN"),
    workerErrorRetryMs: numberEnv("WORKER_ERROR_RETRY_MS", 5_000),
    workerId: env("WORKER_ID", `${hostname()}-${process.pid}`),
    workerPathPrefix,
    workerPollIntervalMs: numberEnv("WORKER_POLL_INTERVAL_MS", 2_000),
    workerSubmitRetryMs: numberEnv("WORKER_SUBMIT_RETRY_MS", 5_000),
  };
}

function validateConfig(config) {
  if (!VALID_MODES.has(config.mode)) {
    throw new Error(`LARK_CODEX_MODE must be one of: ${[...VALID_MODES].join(", ")}`);
  }
  if ((config.mode === "hub" || config.mode === "worker") && !config.hubWorkerToken) {
    throw new Error("HUB_WORKER_TOKEN is required in hub/worker mode");
  }
  if (config.mode === "worker" && !config.hubBaseUrl) {
    throw new Error("HUB_BASE_URL is required in worker mode");
  }
  if (config.resultReplyMode !== "hub" && config.resultReplyMode !== "worker") {
    throw new Error("RESULT_REPLY_MODE must be hub or worker");
  }
  if (
    config.mode === "hub" &&
    config.resultReplyMode === "hub" &&
    config.replyMode !== "cli" &&
    (!config.appId || !config.appSecret)
  ) {
    throw new Error("LARK_APP_ID and LARK_APP_SECRET are required for hub OpenAPI replies");
  }
}

function env(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a number`);
  }
  return value;
}

function boolEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(raw.toLowerCase());
}

function listEnv(name) {
  return env(name)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function normalizePathPrefix(value) {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) {
    return "/worker";
  }
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function loadDotEnv(filePath) {
  const absolute = resolveInputPath(filePath);
  if (!existsSync(absolute)) {
    throw new Error(`env file not found: ${absolute}`);
  }

  for (const line of readFileSync(absolute, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = unquoteEnvValue(rawValue.trim());
  }
}

function resolveInputPath(filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  const fromCwd = path.resolve(filePath);
  if (existsSync(fromCwd)) {
    return fromCwd;
  }

  const fromWorkspace = path.resolve(workspaceRoot, filePath);
  if (existsSync(fromWorkspace)) {
    return fromWorkspace;
  }

  return fromCwd;
}

function unquoteEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function parseArgs(argv) {
  const args = {
    envFile: "",
    help: false,
    mode: "",
    port: 0,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") {
      continue;
    }
    if (arg === "-h" || arg === "--help") {
      args.help = true;
      continue;
    }
    if (arg === "--env-file") {
      args.envFile = readArgValue(argv, ++index, "--env-file");
      continue;
    }
    if (arg === "--mode") {
      args.mode = readArgValue(argv, ++index, "--mode");
      continue;
    }
    if (arg === "--port") {
      args.port = Number(readArgValue(argv, ++index, "--port"));
      if (!Number.isFinite(args.port)) {
        throw new Error("--port must be a number");
      }
      continue;
    }
    throw new Error(`unknown option: ${arg}`);
  }

  return args;
}

function readArgValue(argv, index, option) {
  const value = argv[index];
  if (!value) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage:
  pnpm --filter @garden-lab/lark-codex-bot start
  node tools/lark-codex-bot/src/server.mjs --mode local --env-file tools/lark-codex-bot/.env
  node tools/lark-codex-bot/src/server.mjs --mode hub --env-file tools/lark-codex-bot/.env.hub
  node tools/lark-codex-bot/src/server.mjs --mode worker --env-file tools/lark-codex-bot/.env.worker

Modes:
  local   Receive Feishu events locally and run Codex on the same machine
  hub     Receive Feishu events on a public server and queue tasks for workers
  worker  Poll the hub from a Mac, run Codex locally, and submit results

Options:
  --mode <local|hub|worker>  Override LARK_CODEX_MODE
  --env-file <path>          Load environment variables from a .env file
  --port <port>              Override PORT
  -h, --help                 Show this help`);
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
