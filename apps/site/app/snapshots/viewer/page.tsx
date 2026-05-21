import type { Metadata } from "next";

import { CodexSnapshotStandaloneViewer } from "@/components/codex-snapshot-standalone-viewer";

export const metadata: Metadata = {
  title: "Codex Snapshot Viewer",
  description: "独立窗口中的私有本地会话快照审阅台。",
};

export default function SnapshotViewerPage() {
  return (
    <CodexSnapshotStandaloneViewer snapshotUrl={process.env.NEXT_PUBLIC_CODEX_SNAPSHOT_URL} />
  );
}
