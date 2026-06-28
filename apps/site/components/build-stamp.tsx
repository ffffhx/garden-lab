import { cn } from "@/lib/utils/cn";

// 构建戳：CI 在每次部署时注入 commit SHA 与时间（见 .github/workflows/pages.yml）。
// 本地开发无此环境变量时显示 "dev"。用来一眼判断线上页面是不是最新一次 push：
// 戳里的短 SHA == 仓库最新 commit 短 SHA 就是最新；点开跳到对应提交。
const BUILD_SHA_FULL = process.env.NEXT_PUBLIC_BUILD_SHA ?? "";
const BUILD_SHA = BUILD_SHA_FULL ? BUILD_SHA_FULL.slice(0, 7) : "dev";
const BUILD_TIME = (process.env.NEXT_PUBLIC_BUILD_TIME ?? "").slice(0, 16).replace("T", " ");

export function BuildStamp({ className }: { className?: string }) {
  return (
    <a
      href={
        BUILD_SHA_FULL
          ? `https://github.com/ffffhx/garden-lab/commit/${BUILD_SHA_FULL}`
          : undefined
      }
      target="_blank"
      rel="noreferrer"
      title="本页构建版本（commit）——和仓库最新 commit 对得上就是最新；点开看对应提交"
      className={cn(
        "font-mono-ui inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink/15 bg-paper-soft/80 px-2.5 py-0.5 text-[0.7rem] tracking-[0.06em] text-muted transition hover:border-red/40 hover:text-red",
        className
      )}
    >
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full bg-[#4f7233]" />
      build {BUILD_SHA}
      {BUILD_TIME ? ` · ${BUILD_TIME}` : ""}
    </a>
  );
}
