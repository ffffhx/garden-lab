import { promises as fs } from "node:fs";
import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";

import sanitizeHtml from "sanitize-html";

import { readIdentityFromRequest } from "./auth.js";
import { CONFIG } from "./config.js";

export type SnapshotRecord = {
  id: string;
  createdAt: number;
  ownerUserId?: string;
  title?: string;
  data: any;
};

type SnapshotStore = Record<string, SnapshotRecord>;

let storeCache: SnapshotStore | null = null;

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG.SNAPSHOTS_FILE), { recursive: true });
}

async function loadStore(): Promise<SnapshotStore> {
  if (storeCache) return storeCache;
  await ensureDataDir();
  try {
    const raw = await fs.readFile(CONFIG.SNAPSHOTS_FILE, "utf8");
    storeCache = JSON.parse(raw);
  } catch (err: any) {
    if (err.code === "ENOENT") {
      storeCache = {};
    } else {
      storeCache = {};
    }
  }
  return storeCache!;
}

async function saveStore(store: SnapshotStore): Promise<void> {
  storeCache = store;
  await ensureDataDir();
  await fs.writeFile(CONFIG.SNAPSHOTS_FILE, JSON.stringify(store, null, 2), "utf8");
}

export async function handleCreateSnapshot(
  req: IncomingMessage,
  res: ServerResponse,
  body: any
): Promise<void> {
  if (!body || typeof body !== "object") {
    sendJson(res, 400, { error: "Invalid snapshot body" });
    return;
  }

  const identity = readIdentityFromRequest(req);
  const id = randomBytes(12).toString("hex");

  const sanitizedBody = sanitizeSnapshotData(body);
  const record: SnapshotRecord = {
    id,
    createdAt: Date.now(),
    ownerUserId: identity?.userId,
    title: typeof body.title === "string" ? body.title.slice(0, 200) : "Session Snapshot",
    data: sanitizedBody,
  };

  const store = await loadStore();
  store[id] = record;
  await saveStore(store);

  sendJson(res, 201, {
    id,
    shareUrl: `${CONFIG.PUBLIC_URL}/snapshots/share?id=${id}`,
    createdAt: record.createdAt,
  });
}

export async function handleGetSnapshot(
  req: IncomingMessage,
  res: ServerResponse,
  id: string
): Promise<void> {
  const store = await loadStore();
  const record = store[id];

  if (!record) {
    sendJson(res, 404, { error: "Snapshot not found" });
    return;
  }

  sendJson(res, 200, record);
}

export async function handleDeleteSnapshot(
  req: IncomingMessage,
  res: ServerResponse,
  id: string
): Promise<void> {
  const identity = readIdentityFromRequest(req);
  const store = await loadStore();
  const record = store[id];

  if (!record) {
    sendJson(res, 404, { error: "Snapshot not found" });
    return;
  }

  if (record.ownerUserId && record.ownerUserId !== identity?.userId) {
    sendJson(res, 403, { error: "Not authorized to delete this snapshot" });
    return;
  }

  delete store[id];
  await saveStore(store);

  sendJson(res, 200, { success: true });
}

function sanitizeSnapshotData(data: any): any {
  if (typeof data === "string") {
    return sanitizeHtml(data);
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeSnapshotData);
  }
  if (data !== null && typeof data === "object") {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(data)) {
      cleaned[k] = sanitizeSnapshotData(v);
    }
    return cleaned;
  }
  return data;
}

function sendJson(res: ServerResponse, statusCode: number, data: any): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
