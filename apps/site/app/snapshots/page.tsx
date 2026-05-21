import type { Metadata } from "next";

import { CodexSnapshotModule } from "@/components/codex-snapshot-module";

export const metadata: Metadata = {
  title: "Codex Snapshots",
  description: "私有的本地会话快照审阅模块。",
};

export default function SnapshotsPage() {
  return <CodexSnapshotModule snapshotUrl={process.env.NEXT_PUBLIC_CODEX_SNAPSHOT_URL} />;
}
