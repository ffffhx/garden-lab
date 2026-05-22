import type { Metadata } from "next";

import { CodexSnapshotCloudShare } from "@/components/codex-snapshot-cloud-share";

export const metadata: Metadata = {
  title: "Cloud Snapshot Share",
  description: "通过云端分享的只读会话快照。",
};

export default function SnapshotSharePage() {
  return (
    <CodexSnapshotCloudShare
      apiBaseUrl={
        process.env.NEXT_PUBLIC_SNAPSHOT_SHARE_API_URL ||
        process.env.NEXT_PUBLIC_TOKEN_BOARD_API_URL
      }
    />
  );
}
