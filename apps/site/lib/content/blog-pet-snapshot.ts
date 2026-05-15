import fs from "node:fs";
import path from "node:path";

import {
  BLOG_PET_SNAPSHOT_VERSION,
  buildBlogPetStats,
  type BlogPetSnapshot,
} from "@/lib/content/blog-pet";
import { getAllPosts } from "@/lib/content/posts";
import type { PostSummary } from "@/lib/content/types";

export const BLOG_PET_SNAPSHOT_FILE = path.join(
  process.cwd(),
  "public",
  "pet",
  "stats.json"
);

export function createBlogPetSnapshot(
  posts: PostSummary[] = getAllPosts(),
  now = new Date()
): BlogPetSnapshot {
  return {
    schemaVersion: BLOG_PET_SNAPSHOT_VERSION,
    generatedAt: now.toISOString(),
    pet: buildBlogPetStats(posts, now),
  };
}

type WriteBlogPetSnapshotOptions = {
  preserveGeneratedAtIfUnchanged?: boolean;
};

function snapshotContentKey(snapshot: BlogPetSnapshot) {
  return JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    pet: snapshot.pet,
  });
}

function readExistingBlogPetSnapshot() {
  try {
    const raw = fs.readFileSync(BLOG_PET_SNAPSHOT_FILE, "utf8");
    const parsed = JSON.parse(raw) as BlogPetSnapshot;

    if (parsed.schemaVersion === BLOG_PET_SNAPSHOT_VERSION && parsed.pet) {
      return parsed;
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function writeBlogPetSnapshot(
  snapshot = createBlogPetSnapshot(),
  { preserveGeneratedAtIfUnchanged = true }: WriteBlogPetSnapshotOptions = {}
) {
  const existingSnapshot = preserveGeneratedAtIfUnchanged
    ? readExistingBlogPetSnapshot()
    : undefined;
  const nextSnapshot =
    existingSnapshot &&
    snapshotContentKey(existingSnapshot) === snapshotContentKey(snapshot)
      ? { ...snapshot, generatedAt: existingSnapshot.generatedAt }
      : snapshot;

  fs.mkdirSync(path.dirname(BLOG_PET_SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(
    BLOG_PET_SNAPSHOT_FILE,
    `${JSON.stringify(nextSnapshot, null, 2)}\n`,
    "utf8"
  );

  return nextSnapshot;
}

export function readBlogPetSnapshot() {
  return readExistingBlogPetSnapshot() ?? createBlogPetSnapshot();
}
