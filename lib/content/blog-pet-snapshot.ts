import fs from "node:fs";
import path from "node:path";

import {
  BLOG_PET_SNAPSHOT_PUBLIC_PATH,
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

export function writeBlogPetSnapshot(snapshot = createBlogPetSnapshot()) {
  fs.mkdirSync(path.dirname(BLOG_PET_SNAPSHOT_FILE), { recursive: true });
  fs.writeFileSync(
    BLOG_PET_SNAPSHOT_FILE,
    `${JSON.stringify(snapshot, null, 2)}\n`,
    "utf8"
  );

  return snapshot;
}

export function readBlogPetSnapshot() {
  try {
    const raw = fs.readFileSync(BLOG_PET_SNAPSHOT_FILE, "utf8");
    const parsed = JSON.parse(raw) as BlogPetSnapshot;

    if (parsed.schemaVersion === BLOG_PET_SNAPSHOT_VERSION && parsed.pet) {
      return parsed;
    }
  } catch {
    return createBlogPetSnapshot();
  }

  return createBlogPetSnapshot();
}
