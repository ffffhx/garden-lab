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
      const botId = String(body.botId || "");
      const task = await claimHubTask(config, workerId, botId);
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

    const hubTasks = task.kind === "reset_context"
      ? await enqueueResetContextHubTasks(config, task)
      : [await enqueueHubTask(config, task)];
    sendJson(response, 200, {
      code: 0,
      msg: "queued",
      task_id: hubTasks[0]?.id || "",
      task_ids: hubTasks.map((hubTask) => hubTask.id),
    });

    console.log(
      `queued ${hubTasks.map((hubTask) => hubTask.id).join(",")} from ${task.senderOpenId} in ${task.chatId}: ${task.text.slice(0, 120)}`,
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

  if (task.kind === "reset_context") {
    const removed = await resetChatSessions(config, task);
    const output = buildResetContextReply(config, task, removed);
    const shouldReply = task.resetContext?.reply !== false;
    const replied = config.resultReplyMode === "worker" && shouldReply
      ? await safeReply(config, { expiresAt: 0, tenantAccessToken: "" }, task.messageId, output)
      : false;

    await submitWorkerResultWithRetry(config, hubTask.id, {
      ok: true,
      output,
      relay: null,
      replied,
      sessionId: "",
      timedOut: false,
      workerId: config.workerId,
    });
    return;
  }

  if (task.kind === "chat_messages") {
    const result = await processChatMessagesTask(config, task);
    const output = redactSecrets(config, result.output);
    const text = result.ok
      ? output
      : `读取群消息失败。\n\n${output}`;
    const replied = config.resultReplyMode === "worker"
      ? await safeReply(
        config,
        { expiresAt: 0, tenantAccessToken: "" },
        task.messageId,
        formatReplyText(config, text, result.sessionId),
      )
      : false;

    await submitWorkerResultWithRetry(config, hubTask.id, {
      ok: result.ok,
      output,
      relay: null,
      replied,
      sessionId: result.sessionId,
      timedOut: result.timedOut,
      workerId: config.workerId,
    });
    return;
  }

  const result = await runCodex(config, task);
  const output = redactSecrets(config, result.output);
  const text = result.ok
    ? output
    : `Codex 运行失败${result.timedOut ? "：任务超时" : ""}。\n\n${output}`;
  const relay = buildRelayResult(config, task, { ...result, output });
  const replyText = formatRelayVisibleText(
    config,
    task,
    formatReplyText(config, text, result.sessionId),
    relay,
  );
  const replied = config.resultReplyMode === "worker" && shouldReplyToTask(config, task)
    ? await safeReply(
      config,
      { expiresAt: 0, tenantAccessToken: "" },
      task.messageId,
      replyText,
    )
    : false;

  await submitWorkerResultWithRetry(config, hubTask.id, {
    ok: result.ok,
    output,
    relay,
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
      botId: config.relayBotId,
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

async function enqueueResetContextHubTasks(config, task) {
  const botIds = uniqueNonEmpty([
    task.targetBotId,
    config.relayPeerBotId,
  ]);

  if (botIds.length === 0) {
    return [await enqueueHubTask(config, task)];
  }

  const hubTasks = [];
  for (const [index, botId] of botIds.entries()) {
    hubTasks.push(await enqueueHubTask(config, {
      ...task,
      resetContext: {
        ...(task.resetContext || {}),
        reply: index === 0,
      },
      targetBotId: botId,
    }));
  }
  return hubTasks;
}

async function claimHubTask(config, workerId, botId) {
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

  const task = store.tasks.find((candidate) => (
    candidate.status === "queued" && canWorkerClaimTask(candidate, botId)
  ));
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
  const existingRelayNextTaskId = task.relayNextTaskId || task.result?.relayNextTaskId || "";
  task.status = result.ok ? "done" : "failed";
  task.completedAt = now;
  task.updatedAt = now;
  task.leaseExpiresAt = "";
  task.result = {
    ok: Boolean(result.ok),
    output: String(result.output || ""),
    replied: Boolean(result.replied),
    relayNextTaskId: existingRelayNextTaskId,
    sessionId: String(result.sessionId || ""),
    timedOut: Boolean(result.timedOut),
    workerId: String(result.workerId || task.workerId || ""),
  };

  if (!existingRelayNextTaskId) {
    const relayTask = buildRelayHubTask(config, task, result, now);
    if (relayTask) {
      store.tasks.push(relayTask);
      task.relayNextTaskId = relayTask.id;
      task.result.relayNextTaskId = relayTask.id;
    }
  }

  pruneHubStore(config, store);
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
  if (
    hubTask.repliedAt ||
    hubTask.result?.replied ||
    config.resultReplyMode !== "hub" ||
    !shouldReplyToTask(config, hubTask.task)
  ) {
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
    kind: task.task?.kind || "lark",
    messageId: task.task?.messageId || "",
    relay: task.task?.relay
      ? {
        conversationId: task.task.relay.conversationId || "",
        complete: Boolean(task.task.relay.complete),
        finalBotId: task.task.relay.finalBotId || "",
        fromBotId: task.task.relay.fromBotId || "",
        maxTurns: task.task.relay.maxTurns || 0,
        toBotId: task.task.relay.toBotId || "",
        transcriptEntries: Array.isArray(task.task.relay.transcript) ? task.task.relay.transcript.length : 0,
        turn: task.task.relay.turn || 0,
      }
      : null,
    status: task.status,
    targetBotId: task.task?.targetBotId || "",
    text: task.task?.text ? task.task.text.slice(0, 160) : "",
    updatedAt: task.updatedAt || "",
    workerId: task.workerId || task.result?.workerId || "",
  };
}

function isTerminalTaskStatus(status) {
  return status === "done" || status === "failed";
}

function canWorkerClaimTask(hubTask, botId) {
  const targetBotId = hubTask.task?.targetBotId || "";
  if (!targetBotId) {
    return true;
  }
  return Boolean(botId) && targetBotId === botId;
}

function buildRelayHubTask(config, completedHubTask, result, now) {
  if (!result.ok || !result.relay || typeof result.relay !== "object") {
    return null;
  }

  const relay = result.relay;
  if (relay.complete) {
    return buildRelayFinalHubTask(config, completedHubTask, result, now);
  }

  const fromBotId = String(relay.fromBotId || "");
  const toBotId = String(relay.toBotId || "");
  const text = String(result.output || "").trim();
  if (!fromBotId || !toBotId || !text) {
    return null;
  }

  const previousTask = completedHubTask.task || {};
  const previousRelay = previousTask.relay || {};
  const maxTurns = positiveInt(relay.maxTurns, config.relayMaxTurns);
  const turn = positiveInt(relay.turn, positiveInt(previousRelay.turn, 0) + 1);
  if (turn > maxTurns) {
    return null;
  }

  const conversationId = String(
    relay.conversationId ||
      previousRelay.conversationId ||
      `lark:${previousTask.chatId || "unknown"}:${previousTask.messageId || completedHubTask.id}`,
  );

  return {
    attempts: 0,
    createdAt: now,
    id: randomUUID(),
    result: null,
    status: "queued",
    task: {
      accepted: true,
      chatId: previousTask.chatId || "",
      chatType: previousTask.chatType || "",
      eventId: `relay:${completedHubTask.id}`,
      kind: "relay",
      messageId: previousTask.messageId || "",
      relay: {
        conversationId,
        fromBotId,
        finalBotId: String(relay.finalBotId || ""),
        maxTurns,
        originalText: String(relay.originalText || previousRelay.originalText || previousTask.text || ""),
        sourceTaskId: completedHubTask.id,
        transcript: normalizeRelayTranscript(relay.transcript || previousRelay.transcript),
        toBotId,
        turn,
      },
      senderOpenId: previousTask.senderOpenId || "",
      targetBotId: toBotId,
      text,
    },
    updatedAt: now,
    workerId: "",
  };
}

function buildRelayFinalHubTask(config, completedHubTask, result, now) {
  const previousTask = completedHubTask.task || {};
  const previousRelay = previousTask.relay || {};
  const relay = result.relay || {};
  const finalBotId = String(relay.finalBotId || previousRelay.finalBotId || config.relayFinalBotId || "");
  if (!finalBotId) {
    return null;
  }

  const transcript = normalizeRelayTranscript(relay.transcript || previousRelay.transcript);
  const originalText = String(relay.originalText || previousRelay.originalText || previousTask.text || "");
  const conversationId = String(
    relay.conversationId ||
      previousRelay.conversationId ||
      `lark:${previousTask.chatId || "unknown"}:${previousTask.messageId || completedHubTask.id}`,
  );

  return {
    attempts: 0,
    createdAt: now,
    id: randomUUID(),
    result: null,
    status: "queued",
    task: {
      accepted: true,
      chatId: previousTask.chatId || "",
      chatType: previousTask.chatType || "",
      eventId: `relay-final:${completedHubTask.id}`,
      kind: "relay_final",
      messageId: previousTask.messageId || "",
      relay: {
        complete: true,
        conversationId,
        finalBotId,
        maxTurns: positiveInt(relay.maxTurns, previousRelay.maxTurns || config.relayMaxTurns),
        originalText,
        sourceTaskId: completedHubTask.id,
        transcript,
      },
      senderOpenId: previousTask.senderOpenId || "",
      targetBotId: finalBotId,
      text: originalText || String(result.output || "").trim(),
    },
    updatedAt: now,
    workerId: "",
  };
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
  const expectedTokens = [
    config.verificationToken,
    ...config.verificationTokens,
  ].filter(Boolean);
  if (expectedTokens.length === 0) {
    return;
  }

  const token = payload.header?.token || payload.token;
  if (!token || !expectedTokens.some((expected) => safeEqualText(token, expected))) {
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

  if (matchesResetContextCommand(text)) {
    return {
      accepted: true,
      chatId,
      chatType,
      eventId: payload.header?.event_id || "",
      kind: "reset_context",
      messageId,
      resetContext: {
        scope: "chat",
      },
      senderOpenId,
      targetBotId: config.relayEnabled ? config.relayBotId : "",
      text,
    };
  }

  if (matchesChatMessagesCommand(text)) {
    return {
      accepted: true,
      chatId,
      chatMessageRead: {
        analyze: shouldAnalyzeChatMessages(text),
        limit: config.larkChatMessagesReadLimit,
      },
      chatType,
      eventId: payload.header?.event_id || "",
      kind: "chat_messages",
      messageId,
      senderOpenId,
      targetBotId: config.relayEnabled ? config.relayBotId : "",
      text,
    };
  }

  let relayStart = Boolean(config.relayAutoStartHumanTasks);
  if (config.relayEnabled && config.relayTriggerPrefix) {
    if (text.startsWith(config.relayTriggerPrefix)) {
      relayStart = true;
      text = text.slice(config.relayTriggerPrefix.length).trim();
    } else if (matchesRelayNaturalTrigger(config, text)) {
      relayStart = true;
    } else if (!relayStart) {
      relayStart = false;
    }
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
    kind: "lark",
    messageId,
    relayStart,
    senderOpenId,
    targetBotId: config.relayEnabled ? config.relayBotId : "",
    text,
  };
}

async function processMessageTask(config, tokenCache, task) {
  if (task.replyOnly) {
    await safeReply(config, tokenCache, task.messageId, task.replyOnly);
    return;
  }

  if (task.kind === "reset_context") {
    const removed = await resetChatSessions(config, task);
    await safeReply(config, tokenCache, task.messageId, buildResetContextReply(config, task, removed));
    return;
  }

  if (task.kind === "chat_messages") {
    const result = await processChatMessagesTask(config, task);
    const text = result.ok
      ? result.output
      : `读取群消息失败。\n\n${result.output}`;
    await safeReply(
      config,
      tokenCache,
      task.messageId,
      formatReplyText(config, redactSecrets(config, text), result.sessionId),
    );
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
  const base = task.relay?.conversationId || task.chatId || task.senderOpenId || "unknown";
  const targetBotId = task.targetBotId || task.relay?.toBotId || "";
  return targetBotId ? `${targetBotId}:${base}` : base;
}

async function runCodex(config, task) {
  const startedAtMs = Date.now();
  const tempDir = await mkdtemp(path.join(tmpdir(), "lark-codex-"));
  const outputFile = path.join(tempDir, "last-message.txt");
  const reusableSession = await getReusableSession(config, task);
  const args = buildCodexArgs(config, outputFile, reusableSession?.sessionId || "");
  const prompt = buildCodexPrompt(config, task);

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

function buildCodexPrompt(config, task) {
  const preamble = config.codexPromptPreamble || DEFAULT_PROMPT_PREAMBLE;
  if (task.kind === "chat_messages_analysis") {
    return [
      preamble,
      "",
      "你正在处理飞书群消息分析任务。",
      "worker 已经用 Bot 身份读取了本群最近消息；不要再调用 lark-cli 或飞书 API。",
      "请只基于下面提供的消息记录回答用户请求。如果记录不足，要明确说明缺口。",
      "",
      "用户请求：",
      task.text || "读取本群消息",
      "",
      "最近群消息：",
      formatChatMessagesForPrompt(task.chatMessages || []),
      "",
      "输出要求：",
      "- 用中文回复，可以直接发到飞书。",
      "- 如果用户在找 DDL/deadline/截止时间，优先列出最相关的一条或几条，并说明依据来自哪条消息。",
      "- 附上涉及的发送人、时间和 message_id，方便回溯。",
    ].join("\n");
  }

  if (task.kind === "relay_final") {
    const relay = task.relay || {};
    return [
      preamble,
      "",
      "你是这场双 Codex 讨论的最终汇总者。",
      "请基于用户原始问题和两个机器人的讨论过程，给出一个更好的最终答案。",
      "要求：",
      "- 先给结论，再给关键理由。",
      "- 合并双方有价值的观点，指出必要取舍。",
      "- 不要继续抛给另一个机器人，也不要要求用户手动整理。",
      "- 输出应该可以直接发给飞书里的用户。",
      "",
      "用户原始问题：",
      relay.originalText || task.text || "unknown",
      "",
      "双方讨论记录：",
      formatRelayTranscript(relay.transcript),
      "",
      "中转上下文：",
      `- conversation_id: ${relay.conversationId || "unknown"}`,
      `- final_bot_id: ${relay.finalBotId || task.targetBotId || config.relayBotId || "unknown"}`,
      `- max_turns: ${relay.maxTurns || config.relayMaxTurns}`,
      `- chat_type: ${task.chatType || "unknown"}`,
      `- chat_id: ${task.chatId || "unknown"}`,
      `- message_id: ${task.messageId || "unknown"}`,
    ].join("\n");
  }

  if (task.kind === "relay") {
    const relay = task.relay || {};
    return [
      preamble,
      "",
      "机器人中转对话：",
      relay.originalText ? `用户原始问题：${relay.originalText}` : "",
      relay.transcript?.length ? `此前讨论摘要：\n${formatRelayTranscript(relay.transcript)}` : "",
      "",
      `上一位机器人（${relay.fromBotId || "unknown"}）的消息：`,
      task.text,
      "",
      "请作为当前 Codex 机器人生成一段回复，面向对方机器人继续对话。",
      "保持回复具体、简洁，主动推进方案质量，可以提出反驳、风险和改进建议。",
      "如果你认为已经接近结论，也请给出你建议最终答案应该包含的要点。",
      "",
      "中转上下文：",
      `- conversation_id: ${relay.conversationId || "unknown"}`,
      `- from_bot_id: ${relay.fromBotId || "unknown"}`,
      `- to_bot_id: ${relay.toBotId || config.relayBotId || "unknown"}`,
      `- final_bot_id: ${relay.finalBotId || "unknown"}`,
      `- turn: ${relay.turn || 0}`,
      `- max_turns: ${relay.maxTurns || config.relayMaxTurns}`,
      `- chat_type: ${task.chatType || "unknown"}`,
      `- chat_id: ${task.chatId || "unknown"}`,
      `- message_id: ${task.messageId || "unknown"}`,
    ].filter((line) => line !== "").join("\n");
  }

  const lines = [
    preamble,
    "",
    "飞书用户请求：",
    task.text,
    "",
  ];

  if (task.relayStart) {
    lines.push(
      "这条消息会启动机器人间中转对话。",
      `你的回复会被发送给对方机器人（${config.relayPeerBotId || "unknown"}）作为下一轮输入。`,
      `最多中转 ${config.relayMaxTurns} 轮。`,
      "",
    );
  }

  lines.push(
    "飞书事件上下文：",
    `- chat_type: ${task.chatType || "unknown"}`,
    `- chat_id: ${task.chatId || "unknown"}`,
    `- message_id: ${task.messageId}`,
    `- sender_open_id: ${task.senderOpenId || "unknown"}`,
  );

  return lines.join("\n");
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

  for (const dir of config.codexAddDirs) {
    args.push("--add-dir", dir);
  }

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

function buildRelayResult(config, task, result) {
  if (!config.relayEnabled || !result.ok || task.kind === "relay_final") {
    return null;
  }

  const currentBotId = config.relayBotId;
  if (!currentBotId) {
    return null;
  }

  if (task.kind === "relay") {
    const relay = task.relay || {};
    const maxTurns = positiveInt(relay.maxTurns, config.relayMaxTurns);
    const currentTurn = positiveInt(relay.turn, 0);
    const transcript = appendRelayTranscript(
      config,
      relay.transcript,
      currentBotId,
      result.output,
    );
    if (currentTurn >= maxTurns) {
      if (!config.relayFinalEnabled) {
        return null;
      }

      return {
        complete: true,
        conversationId: relay.conversationId || makeRelayConversationId(task),
        finalBotId: relay.finalBotId || config.relayFinalBotId || currentBotId,
        fromBotId: currentBotId,
        maxTurns,
        originalText: relay.originalText || task.text || "",
        transcript,
        turn: currentTurn,
      };
    }

    const toBotId = relay.fromBotId || config.relayPeerBotId;
    if (!toBotId) {
      return null;
    }

    return {
      conversationId: relay.conversationId || makeRelayConversationId(task),
      finalBotId: relay.finalBotId || config.relayFinalBotId || currentBotId,
      fromBotId: currentBotId,
      maxTurns,
      originalText: relay.originalText || task.text || "",
      transcript,
      toBotId,
      turn: currentTurn + 1,
    };
  }

  if (!task.relayStart || !config.relayPeerBotId) {
    return null;
  }

  return {
    conversationId: makeRelayConversationId(task),
    finalBotId: config.relayFinalBotId || currentBotId,
    fromBotId: currentBotId,
    maxTurns: config.relayMaxTurns,
    originalText: task.text || "",
    transcript: appendRelayTranscript(config, [], currentBotId, result.output),
    toBotId: config.relayPeerBotId,
    turn: 1,
  };
}

function makeRelayConversationId(task) {
  return `lark:${task.chatId || "unknown"}:${task.messageId || randomUUID()}`;
}

function appendRelayTranscript(config, transcript, botId, text) {
  const entries = normalizeRelayTranscript(transcript);
  entries.push({
    botId,
    text: String(text || "").trim(),
  });
  return trimRelayTranscript(entries, config.relayTranscriptMaxChars);
}

function normalizeRelayTranscript(transcript) {
  if (!Array.isArray(transcript)) {
    return [];
  }

  return transcript
    .map((entry) => ({
      botId: String(entry?.botId || entry?.fromBotId || "unknown"),
      text: String(entry?.text || "").trim(),
    }))
    .filter((entry) => entry.text);
}

function trimRelayTranscript(transcript, maxChars) {
  const entries = normalizeRelayTranscript(transcript);
  while (entries.length > 1 && JSON.stringify(entries).length > maxChars) {
    entries.shift();
  }
  return entries;
}

function formatRelayTranscript(transcript) {
  const entries = normalizeRelayTranscript(transcript);
  if (entries.length === 0) {
    return "（暂无讨论记录）";
  }

  return entries
    .map((entry, index) => [
      `### ${index + 1}. ${entry.botId}`,
      entry.text,
    ].join("\n"))
    .join("\n\n");
}

function formatRelayVisibleText(config, task, text, relay) {
  if (!relay || !config.relayVisibleMention) {
    return text;
  }

  const prefix = task.kind === "relay"
    ? `${config.relayVisibleMention} `
    : `${config.relayVisibleMention} 我先说这一轮：\n`;
  return limitText(`${prefix}${text}`, config.maxOutputChars);
}

function shouldReplyToTask(config, task) {
  if (task.kind === "reset_context") {
    return task.resetContext?.reply !== false;
  }
  if (task.kind === "relay_final") {
    return true;
  }
  if (task.kind === "relay" || task.relayStart) {
    return config.relayReplyIntermediate;
  }
  return true;
}

async function processChatMessagesTask(config, task) {
  const limit = clampNumber(task.chatMessageRead?.limit || config.larkChatMessagesReadLimit, 1, 50);
  const readResult = await readChatMessagesViaCli(config, task.chatId, limit);
  if (!readResult.ok) {
    return {
      ok: false,
      output: readResult.error,
      sessionId: "",
      timedOut: false,
    };
  }

  if (task.chatMessageRead?.analyze) {
    const analysisTask = {
      ...task,
      chatMessages: readResult.messages,
      kind: "chat_messages_analysis",
    };
    return runCodex(config, analysisTask);
  }

  return {
    ok: true,
    output: formatChatMessagesReply(readResult.messages, task.chatId),
    sessionId: "",
    timedOut: false,
  };
}

async function readChatMessagesViaCli(config, chatId, limit) {
  if (!chatId) {
    return {
      ok: false,
      error: "缺少 chat_id，无法读取当前群消息。",
      messages: [],
    };
  }

  const result = await runLarkCli(config, [
    "im",
    "+chat-messages-list",
    "--as",
    "bot",
    "--chat-id",
    chatId,
    "--page-size",
    String(limit),
    "--format",
    "json",
  ]);

  if (result.code !== 0) {
    return {
      ok: false,
      error: [
        "worker 已尝试用 Bot 身份读取本群消息，但 lark-cli 调用失败。",
        "",
        redactSecrets(config, result.stderr || result.stdout || `exit code ${result.code}`),
      ].join("\n"),
      messages: [],
    };
  }

  const parsed = tryParseJsonFromOutput(result.stdout);
  if (!parsed?.ok) {
    return {
      ok: false,
      error: `lark-cli 返回无法解析或非成功结果：\n${redactSecrets(config, result.stdout || result.stderr || "<empty>")}`,
      messages: [],
    };
  }

  return {
    ok: true,
    messages: normalizeChatMessages(parsed.data?.messages),
  };
}

async function runLarkCli(config, args) {
  let stdout = "";
  let stderr = "";
  const child = spawn(config.larkCliBin, args, {
    cwd: config.codexWorkdir,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    stdout = appendLimited(stdout, chunk.toString("utf8"), MAX_CAPTURE_CHARS);
  });
  child.stderr.on("data", (chunk) => {
    stderr = appendLimited(stderr, chunk.toString("utf8"), MAX_CAPTURE_CHARS);
  });

  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });

  return { code, stdout, stderr };
}

function normalizeChatMessages(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages.map((message) => ({
    content: String(message.content || "").trim(),
    createTime: String(message.create_time || message.createTime || ""),
    deleted: Boolean(message.deleted),
    messageId: String(message.message_id || message.messageId || ""),
    msgType: String(message.msg_type || message.msgType || "unknown"),
    senderId: String(message.sender?.id || ""),
    senderName: String(message.sender?.name || message.sender?.id || "unknown"),
    updated: Boolean(message.updated),
  }));
}

function formatChatMessagesReply(messages, chatId) {
  if (messages.length === 0) {
    return `已读取本群消息（${chatId}），但最近记录为空。`;
  }

  return limitText([
    `已读取本群最近 ${messages.length} 条消息：`,
    "",
    ...messages.map((message, index) => formatChatMessageLine(message, index)),
  ].join("\n"), 6_000);
}

function formatChatMessagesForPrompt(messages) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "（没有读取到最近群消息）";
  }

  return messages
    .map((message, index) => formatChatMessageLine(message, index))
    .join("\n");
}

function formatChatMessageLine(message, index) {
  const flags = [
    message.deleted ? "deleted" : "",
    message.updated ? "updated" : "",
  ].filter(Boolean);
  const suffix = flags.length ? ` (${flags.join(",")})` : "";
  const content = message.content || `[${message.msgType || "unknown"}]`;
  return `${index + 1}. [${message.createTime || "unknown"}] ${message.senderName}: ${content}${suffix}\n   message_id: ${message.messageId || "unknown"}`;
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

async function resetChatSessions(config, task) {
  const store = await readSessionStore(config);
  const entries = Object.entries(store.chats || {});
  let removed = 0;

  for (const [key, session] of entries) {
    if (isSessionForTaskChat(key, session, task)) {
      delete store.chats[key];
      removed += 1;
    }
  }

  if (removed > 0) {
    await writeSessionStore(config, store);
  }

  return removed;
}

function isSessionForTaskChat(key, session, task) {
  const chatId = task.chatId || "";
  if (!chatId) {
    return false;
  }
  return session?.chatId === chatId || key.includes(chatId);
}

function buildResetContextReply(config, task, removed) {
  const botLabel = config.relayBotId ? `（${config.relayBotId}）` : "";
  const suffix = removed > 0 ? `已清理 ${removed} 条旧会话映射。` : "没有找到旧会话映射，也会从下一条消息开始使用新会话。";
  if (task.resetContext?.reply === false) {
    return `已重置上下文${botLabel}。${suffix}`;
  }
  return `已新开上下文${botLabel}。${suffix}\nA/B 两个 worker 都已收到重置任务；下一条消息会使用新的 Codex 会话。`;
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

function matchesRelayNaturalTrigger(config, text) {
  if (!config.relayNaturalTriggerEnabled || !text) {
    return false;
  }

  try {
    return new RegExp(config.relayNaturalTriggerPattern, "i").test(text);
  } catch (error) {
    console.warn(`invalid RELAY_NATURAL_TRIGGER_PATTERN: ${error.message}`);
    return false;
  }
}

function matchesResetContextCommand(text) {
  return /(?:^|[\s，,。.!！])(新开|重置|清空|开启新|重新开始)(一下|当前|这个|本群|机器人|codex|Codex|上下文|会话|对话|\s)*(上下文|会话|对话)(?:$|[\s，,。.!！])/.test(text);
}

function matchesChatMessagesCommand(text) {
  const normalized = String(text || "");
  const mentionsChatHistory = /(?:本群|群里|群内|群中|聊天记录|群消息|消息记录|最近消息|历史消息)/.test(normalized);
  const asksToRead = /(?:读|读取|查|查询|看|拉取|获取|找|搜索|总结|提取|最近|ddl|DDL|deadline|截止)/.test(normalized);
  if (mentionsChatHistory && asksToRead) {
    return true;
  }

  const mentionsDeadline = /(?:ddl|DDL|deadline|Deadline|截至|截止|交付|上线|到期)/.test(normalized);
  const asksForRecentOrSearch = /(?:找出?|查(?:询|找)?|搜(?:索)?|提取|有没有|最近(?:的|一条)?|哪(?:个|些)|是什么|看(?:看)?)/.test(normalized);
  return mentionsDeadline && asksForRecentOrSearch;
}

function shouldAnalyzeChatMessages(text) {
  return /(?:ddl|DDL|deadline|截至|截止|交付|上线|到期|总结|摘要|提取|找|搜索|查询|最近的|有没有|是什么|哪些|谁说|谁发)/.test(text);
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

function tryParseJsonFromOutput(output) {
  const start = String(output || "").indexOf("{");
  if (start === -1) {
    return null;
  }
  return tryParseJson(String(output).slice(start));
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
    codexAddDirs: listEnv("CODEX_ADD_DIRS").map((dir) => path.resolve(dir)),
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
    larkChatMessagesReadLimit: numberEnv("LARK_CHAT_MESSAGES_READ_LIMIT", 20),
    larkCliBin: env("LARK_CLI_BIN", "lark-cli"),
    maxBodyBytes: numberEnv("MAX_BODY_BYTES", 1_000_000),
    maxOutputChars: numberEnv("CODEX_MAX_OUTPUT_CHARS", 6_000),
    mode,
    port: args.port || numberEnv("PORT", 8787),
    replyInThread: boolEnv("LARK_REPLY_IN_THREAD", false),
    replyMode: env("LARK_REPLY_MODE", mode === "hub" ? "openapi" : "cli"),
    resultReplyMode: env("RESULT_REPLY_MODE", "hub"),
    relayAutoStartHumanTasks: boolEnv("RELAY_AUTO_START_HUMAN_TASKS", false),
    relayBotId: env("RELAY_BOT_ID"),
    relayEnabled: boolEnv("RELAY_ENABLED", false),
    relayFinalBotId: env("RELAY_FINAL_BOT_ID"),
    relayFinalEnabled: boolEnv("RELAY_FINAL_ENABLED", false),
    relayMaxTurns: numberEnv("RELAY_MAX_TURNS", 6),
    relayNaturalTriggerEnabled: boolEnv("RELAY_NATURAL_TRIGGER_ENABLED", false),
    relayNaturalTriggerPattern: env(
      "RELAY_NATURAL_TRIGGER_PATTERN",
      "讨论|辩论|评审|评估|复盘|头脑风暴|两个.*(机器人|Codex|codex)|双机器人|A/B|AB|方案.*(讨论|评审|评估|分析)|(?:讨论|评审|评估|分析).*方案",
    ),
    relayPeerBotId: env("RELAY_PEER_BOT_ID"),
    relayReplyIntermediate: boolEnv("RELAY_REPLY_INTERMEDIATE", true),
    relayTranscriptMaxChars: numberEnv("RELAY_TRANSCRIPT_MAX_CHARS", 24_000),
    relayTriggerPrefix: env("RELAY_TRIGGER_PREFIX", "/relay"),
    relayVisibleMention: env("RELAY_VISIBLE_MENTION"),
    sendRunningMessage: boolEnv("LARK_SEND_RUNNING_MESSAGE", true),
    signatureMaxAgeSeconds: numberEnv("LARK_SIGNATURE_MAX_AGE_SECONDS", 10 * 60),
    verificationToken: env("LARK_VERIFICATION_TOKEN"),
    verificationTokens: listEnv("LARK_VERIFICATION_TOKENS"),
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
  if (config.larkChatMessagesReadLimit < 1 || config.larkChatMessagesReadLimit > 50) {
    throw new Error("LARK_CHAT_MESSAGES_READ_LIMIT must be between 1 and 50");
  }
  if (config.relayMaxTurns < 1) {
    throw new Error("RELAY_MAX_TURNS must be greater than 0");
  }
  if (config.relayTranscriptMaxChars < 1_000) {
    throw new Error("RELAY_TRANSCRIPT_MAX_CHARS must be at least 1000");
  }
  if (config.relayEnabled && !config.relayBotId) {
    throw new Error("RELAY_BOT_ID is required when RELAY_ENABLED=true");
  }
  if (
    config.relayEnabled &&
    config.mode === "worker" &&
    (config.relayAutoStartHumanTasks || config.relayTriggerPrefix) &&
    !config.relayPeerBotId
  ) {
    throw new Error("RELAY_PEER_BOT_ID is required to start relay conversations");
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

function positiveInt(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 1) {
    return fallback;
  }
  return Math.floor(number);
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.floor(number)));
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

function uniqueNonEmpty(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
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
