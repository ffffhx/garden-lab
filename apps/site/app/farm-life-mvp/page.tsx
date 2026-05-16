import type { Metadata } from "next";
import Link from "next/link";

import { withBasePath } from "@/lib/utils/site-path";

const townSignals = [
  {
    label: "时间",
    value: "06:00",
    detail: "从清晨农田到夜色小镇，行动会推动一天向前走。",
    tone: "border-[#f1c45c]/28 bg-[#f1c45c]/12 text-[#fff0be]",
  },
  {
    label: "目标",
    value: "接公告板",
    detail: "每天有一条清晰路线：读信、看板、耕作、拜访、入箱。",
    tone: "border-[#7be3a0]/24 bg-[#103326] text-[#c9ffd8]",
  },
  {
    label: "邻里",
    value: "NPC 日程",
    detail: "镇民按时间移动，聊天和送礼会把关系慢慢织起来。",
    tone: "border-[#ff9b7c]/24 bg-[#321b18] text-[#ffd9cc]",
  },
  {
    label: "季节",
    value: "春 1",
    detail: "天气、节日和农场评级会改变一天的经营节奏。",
    tone: "border-[#6ea3ff]/24 bg-[#10233c] text-[#dceaff]",
  },
];

const loopSteps = [
  "小屋醒来，读信看天气。",
  "去小镇公告板接下今日委托。",
  "顺路拜访镇民，带上合适礼物。",
  "回农场耕作、浇水、钓鱼或采集。",
  "睡前把收获放进售卖箱，结算第二天。",
];

const systemTiles = [
  {
    title: "小镇模拟感",
    body: "把 NPC 日程、节日、公告板和路线提示放到同一个节奏里，页面不再像开发备忘录，而像一个已经亮灯的小世界。",
  },
  {
    title: "沉浸式 UI",
    body: "深色像素边框、金色标题、状态胶囊和低饱和面板呼应 AI 小镇视觉，保留农场游戏的温暖材质。",
  },
  {
    title: "可玩入口优先",
    body: "首屏直接展示游戏画面，说明内容收拢到下方，玩家先看到场景、角色、HUD 和交互反馈。",
  },
  {
    title: "后续可扩展",
    body: "农场、小屋、小镇、商店、海边、矿洞等场景仍沿用 Tiled JSON 和 Phaser 架构，方便继续扩地图。",
  },
];

const mapStops = [
  ["小屋", "天气、邮箱、睡觉结算"],
  ["农场", "耕地、浇水、收获、售卖箱"],
  ["小镇", "公告板、邻里、节日路线"],
  ["种子铺", "购买种子、折扣和经营反馈"],
  ["池塘/海边", "钓鱼、采集、睡前入箱"],
];

export const metadata: Metadata = {
  title: "山居种田 MVP",
  description: "一个类星露谷网页版种田游戏的可玩 MVP 原型。",
};

export default function FarmLifeMvpPage() {
  const gameSrc = withBasePath("/games/farm-life/index.html");

  return (
    <main className="-mx-4 -mt-7 bg-[#0b1020] text-[#f8f1e5] sm:-mx-6 lg:-mx-8">
      <section className="relative overflow-hidden border-b border-white/10 bg-[#111827]">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(24,20,37,0.92),rgba(11,16,32,0.98))]" />
        <div className="absolute inset-x-0 top-0 h-32 bg-[linear-gradient(90deg,rgba(254,199,66,0.18),rgba(90,205,232,0.12),rgba(123,227,160,0.14))]" />
        <div className="relative mx-auto grid max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:min-h-[calc(100vh-9rem)] lg:px-8 lg:py-7">
          <div className="flex min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
              <span className="border border-[#f1c45c]/35 bg-[#f1c45c]/12 px-3 py-1 text-[#ffe2a8]">
                Playable MVP
              </span>
              <span className="border border-white/12 bg-white/8 px-3 py-1 text-white/76">
                Phaser + Tiled
              </span>
              <span className="border border-[#7be3a0]/24 bg-[#10291f] px-3 py-1 text-[#bdf5cc]">
                AI 小镇风格改造
              </span>
            </div>

            <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <h1 className="text-4xl font-black leading-none text-[#fec742] [text-shadow:0_0.08em_0_#6e2146] sm:text-6xl lg:text-7xl">
                  山居种田
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-7 text-[#f8f1e5]/82 sm:text-lg">
                  把类星露谷原型收进更像 AI 小镇的像素沙盒：清晰的世界状态、发光的游戏框、镇民日程和公告板目标一起出现在第一眼。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={gameSrc}
                  className="inline-flex min-h-10 items-center justify-center border-2 border-[#181425] bg-[#fec742] px-4 text-sm font-black text-[#181425] shadow-[4px_4px_0_#6e2146] transition hover:-translate-y-0.5 hover:bg-[#ffe28a]"
                >
                  打开独立版本
                </Link>
                <Link
                  href="/games"
                  className="inline-flex min-h-10 items-center justify-center border-2 border-white/20 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/16"
                >
                  返回游戏入口
                </Link>
              </div>
            </div>

            <div className="mt-5 overflow-x-auto overflow-y-hidden border-[6px] border-[#181425] bg-[#181425] shadow-[0_30px_90px_-42px_rgba(0,0,0,0.9)]">
              <iframe
                src={gameSrc}
                title="山居种田 MVP 游戏原型"
                className="h-[540px] w-[960px] max-w-none bg-[#111827] md:aspect-video md:h-auto md:min-h-[280px] md:w-full"
              />
            </div>
          </div>

          <aside className="grid content-start gap-3 md:grid-cols-2 lg:grid-cols-5">
            <div className="border border-white/12 bg-white/8 p-4 shadow-[0_18px_70px_-55px_rgba(0,0,0,0.85)]">
              <p className="text-sm font-semibold text-[#f1c45c]">溪山镇看板</p>
              <h2 className="mt-2 text-2xl font-black leading-tight text-white">今天的世界正在运行</h2>
              <p className="mt-3 text-sm leading-6 text-white/68">
                页面视觉向 AI 小镇靠拢，但保留山居种田的温暖农场气质。
              </p>
            </div>
            {townSignals.map((item) => (
              <article key={item.label} className={`border p-4 ${item.tone}`}>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-white/68">{item.label}</p>
                  <p className="font-mono text-sm font-black">{item.value}</p>
                </div>
                <p className="mt-3 text-sm leading-6 text-white/72">{item.detail}</p>
              </article>
            ))}
          </aside>
        </div>
      </section>

      <section className="bg-[#f8f1e5] text-[#181425]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)] lg:px-8">
          <div>
            <p className="text-sm font-black text-[#b86f50]">Core Loop</p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">
              从说明页改成一段可感知的小镇日常
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-8 text-[#4b5563]">
              改造重点是让玩家先进入场景，再理解系统。农场闭环仍然轻量，但视觉节奏更接近 AI 小镇：大画面、像素边框、状态条和清晰目标并排出现。
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2">
            {loopSteps.map((step, index) => (
              <li
                key={step}
                className="min-h-20 border border-[#181425]/10 bg-white/78 p-4 shadow-[0_16px_45px_-38px_rgba(24,20,37,0.7)]"
              >
                <span className="font-mono text-sm font-black text-[#b86f50]">
                  {(index + 1).toString().padStart(2, "0")}
                </span>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#283044]">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y border-white/10 bg-[#151a2e]">
        <div className="mx-auto grid max-w-7xl gap-4 px-4 py-8 sm:px-6 md:grid-cols-2 lg:grid-cols-4 lg:px-8">
          {systemTiles.map((item) => (
            <article key={item.title} className="border border-white/10 bg-white/7 p-5 text-white">
              <h3 className="text-xl font-black text-[#fec742]">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-white/72">{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="bg-[#fffdf7] text-[#181425]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:px-8">
          <div>
            <p className="text-sm font-black text-[#26745e]">Map Rhythm</p>
            <h2 className="mt-2 text-3xl font-black leading-tight sm:text-4xl">地图做小，生活感要亮出来</h2>
            <div className="mt-6 grid gap-3">
              {mapStops.map(([place, detail]) => (
                <div
                  key={place}
                  className="grid gap-3 border border-[#181425]/10 bg-[#f5efe4] p-4 sm:grid-cols-[8rem_minmax(0,1fr)]"
                >
                  <h3 className="font-black text-[#181425]">{place}</h3>
                  <p className="text-sm leading-6 text-[#4b5563]">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="border border-[#181425] bg-[#181425] p-4 text-[#f8f1e5] shadow-[8px_8px_0_#fec742]">
            <p className="text-sm font-black text-[#fec742]">Next Build</p>
            <h2 className="mt-2 text-2xl font-black leading-tight">下一轮可以继续加深世界</h2>
            <p className="mt-4 text-sm leading-7 text-white/72">
              现在的 UI 先把游戏入口、HUD 和主要菜单统一到像素小镇气质。后续适合继续补 NPC 事件、室内扩建、节日场景和更多角色反馈。
            </p>
            <div className="mt-5 grid gap-2 text-sm font-semibold">
              <span className="border border-[#7be3a0]/24 bg-[#10291f] px-3 py-2 text-[#bdf5cc]">
                NPC 关系事件
              </span>
              <span className="border border-[#f1c45c]/24 bg-[#2e2512] px-3 py-2 text-[#ffe2a8]">
                节日活动与镇民集会
              </span>
              <span className="border border-[#6ea3ff]/24 bg-[#102034] px-3 py-2 text-[#d9e8ff]">
                室内地图与更多工具动作
              </span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
