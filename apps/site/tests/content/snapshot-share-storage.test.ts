import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createSnapshotShareStore,
  type SnapshotShareRecord,
} from "@/lib/snapshot-share-storage";

describe("snapshot share storage", () => {
  it("stores public snapshot shares without exposing publisher metadata", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "snapshot-share-storage-"));
    const store = await createSnapshotShareStore({
      dataFile: path.join(dir, "snapshot-shares.json"),
    });

    await store.putShare(shareRecord({ id: "snap_test" }));

    const share = await store.getShare("snap_test");

    expect(share?.id).toBe("snap_test");
    expect(share?.title).toBe("测试分享");
    expect("publisher" in (share || {})).toBe(false);
    expect(await store.countShares()).toBe(1);
  });

  it("hides expired snapshot shares", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "snapshot-share-storage-"));
    const store = await createSnapshotShareStore({
      dataFile: path.join(dir, "snapshot-shares.json"),
    });

    await store.putShare(
      shareRecord({
        id: "snap_expired",
        expiresAt: "2020-01-01T00:00:00.000Z",
      })
    );

    expect(await store.getShare("snap_expired")).toBeUndefined();
    expect(await store.countShares()).toBe(0);
  });
});

function shareRecord(overrides: Partial<SnapshotShareRecord>): SnapshotShareRecord {
  return {
    id: "snap_test",
    title: "测试分享",
    engine: "codex",
    engineLabel: "Codex",
    createdAt: "2026-05-22T00:00:00.000Z",
    updatedAt: "2026-05-22T00:00:00.000Z",
    redacted: true,
    turnCount: 2,
    publisher: {
      userId: "github:1",
      displayName: "Feng",
    },
    snapshot: {
      title: "测试分享",
      turns: [
        { role: "user", text: "你好" },
        { role: "assistant", text: "你好呀" },
      ],
    },
    ...overrides,
  };
}
