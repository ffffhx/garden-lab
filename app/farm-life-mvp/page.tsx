import type { Metadata } from "next";
import Link from "next/link";

import { withBasePath } from "@/lib/utils/site-path";

const stackItems = [
  {
    name: "Phaser",
    detail: "负责 2D 渲染、输入、场景、动画、相机和基础碰撞。",
  },
  {
    name: "TypeScript",
    detail: "给作物、背包、存档和地图对象建立清晰的数据契约。",
  },
  {
    name: "Vite",
    detail: "作为独立游戏包的开发与构建工具，后续可嵌入博客页面。",
  },
  {
    name: "Tiled JSON",
    detail: "农场、小镇和商店已经改为 Tiled 兼容 JSON，地图层、碰撞、NPC、公告板和交互点都从地图对象读取。",
  },
  {
    name: "localStorage",
    detail: "MVP 只做本地单存档，云存档和账号系统放到后续阶段。",
  },
];

const coreSystems = [
  {
    title: "时间系统",
    text: "每天从 06:00 开始，移动、耕种、购物和聊天都会推进时间，太晚会自动回家休息。",
  },
  {
    title: "体力系统",
    text: "锄地、播种、浇水、收获会消耗体力，睡觉恢复满体力，迫使玩家规划当天行动。",
  },
  {
    title: "农田系统",
    text: "每块地记录开垦、浇水、作物 ID、成长天数和成熟状态。",
  },
  {
    title: "作物系统",
    text: "萝卜、小麦、土豆三种作物，每种有种子价格、成长天数和售卖价格。",
  },
  {
    title: "背包系统",
    text: "12 格背包，支持种子和作物堆叠，工具固定在快捷栏。",
  },
  {
    title: "经济系统",
    text: "商店购买种子，农场售卖箱提交作物，睡觉后统一结算金币和公告板订单奖励。",
  },
  {
    title: "社交系统",
    text: "NPC 按时间段切换地点和活动，每天首次对话会累计好感，活动日会有额外收益。",
  },
  {
    title: "任务系统",
    text: "山居线索串起读信、接单、开垦、播种、浇水、入箱、结算和拜访邻里的第一条连续任务链。",
  },
  {
    title: "存档系统",
    text: "保存天数、金币、玩家位置、背包和所有农田格子状态。",
  },
  {
    title: "天气与 NPC",
    text: "每日天气会影响作物浇水和地图氛围，NPC 从地图对象生成并按路线移动、对话。",
  },
];

const scenes = [
  {
    name: "FarmScene",
    purpose: "农场主场景，承载移动、耕种、浇水、收获、售卖箱和床。",
  },
  {
    name: "TownScene",
    purpose: "小镇一条街，只开放种子商店，其余建筑先作为占位。",
  },
  {
    name: "SeedShopScene",
    purpose: "商店内景，提供三种种子购买和金币余额反馈。",
  },
  {
    name: "UIScene",
    purpose: "常驻 UI，显示右上角时间金币面板、底部工具栏、背包摘要、订单卡和交互提示。",
  },
  {
    name: "SleepScene",
    purpose: "当天结算页，展示售卖收入、作物成长和进入下一天。",
  },
];

const assets = [
  "玩家四方向三帧走路 spritesheet",
  "锄地、浇水、播种、收获工具动作和合成短音效",
  "草地、泥土、耕地、湿润耕地、石子路、围栏、花、树、石头 tileset",
  "萝卜、小麦、土豆的种子、幼苗、成长中、成熟阶段",
  "种子商店外观、商店内景、货架、柜台、老板占位图",
  "小镇公告板、NPC 好感反馈和每日订单 UI",
  "木质 HUD、金币/天气/体力/声音图标、底部图标工具栏、背包菜单、睡觉结算屏、萝卜/小麦/土豆 crop logo、操作漂浮反馈、对话框和背包格",
  "铁匠铺、医馆、居民房等未开放建筑占位",
];

const milestones = [
  {
    phase: "第 1 周",
    target: "跑通工程、地图、玩家移动和农场/小镇/商店场景切换。",
  },
  {
    phase: "第 2 周",
    target: "完成开垦、播种、浇水、作物成长、收获和售卖闭环。",
  },
  {
    phase: "第 3 周",
    target: "补齐背包、商店、睡觉结算、本地存档和基础 UI 反馈。",
  },
  {
    phase: "第 4 周",
    target: "替换关键美术、完善动画、接入博客游戏模块并做构建验证。",
  },
];

export const metadata: Metadata = {
  title: "山居种田 MVP",
  description: "一个类星露谷网页版种田游戏的可玩 MVP 原型。",
};

export default function FarmLifeMvpPage() {
  const gameSrc = withBasePath("/games/farm-life/index.html");

  return (
    <main className="space-y-8">
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-900/10 bg-slate-950 text-white shadow-[0_32px_100px_-60px_rgba(15,23,42,0.9)]">
        <div className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.24em] text-emerald-200">Playable MVP</p>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">山居种田</h1>
              <p className="max-w-3xl text-base leading-8 text-slate-200">
                纯前端单机版原型：已换用 Farm RPG 像素美术素材包，Tiled 可滚动大地图、相机跟随、按住方向键连续移动、J 键山居日志、季节日历、每日目标、山居线索任务链、NPC 分时段日程、原创小事件、活动加成、农场、小屋室内、小镇道路、种子商店、三种作物、池塘钓鱼、每日野外采集、NPC 聊天送礼、邮箱信件、电视天气预报、天气、季节、体力、时间、公告板订单、三帧走路动画、原创合成音效、种子目录购买弹窗、底部图标工具栏、作物 logo、HUD 图标、背包菜单、睡觉结算屏、操作漂浮反馈、对话框、售卖箱和本地存档已经接入。
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm font-semibold">
              <span className="rounded-full bg-emerald-300 px-4 py-2 text-emerald-950">
                Phaser
              </span>
              <span className="rounded-full bg-amber-300 px-4 py-2 text-amber-950">
                Vite
              </span>
              <Link
                href={gameSrc}
                className="rounded-full bg-white px-4 py-2 text-slate-950 transition hover:bg-emerald-100"
                style={{ color: "#0f172a" }}
              >
                打开独立版本
              </Link>
            </div>
          </div>
          <iframe
            src={gameSrc}
            title="山居种田 MVP 游戏原型"
            className="aspect-video w-full rounded-[0.75rem] border border-white/10 bg-slate-900"
          />
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Core Loop</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            第一版只守住一条闭环
          </h2>
          <ol className="mt-5 space-y-3 text-base leading-8 text-slate-700">
            <li>1. 在小屋起床，看电视预报和背包状态。</li>
            <li>2. 出门看邮箱，再去小镇看公告板，顺路购买种子、跟着 NPC 日程聊天送礼。</li>
            <li>3. 在农场和小镇顺手采山莓、蘑菇或野花。</li>
            <li>4. 在池塘边抛竿，钓到的鱼也能入箱结算。</li>
            <li>5. 回农场按体力开垦、播种、浇水。</li>
            <li>6. 成熟后收获，把作物、采集物和渔获投入售卖箱。</li>
            <li>7. 睡觉，结算金币、订单奖励、作物成长和第二天状态。</li>
          </ol>
        </div>

        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Map Scope</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            地图做小，但世界要露头
          </h2>
          <div className="mt-5 rounded-[0.75rem] bg-slate-950 p-5 font-mono text-sm leading-7 text-slate-100">
            <p>农场</p>
            <p>  ├─ 小屋：开放</p>
            <p>  ↓ 石子路</p>
            <p>小镇街道</p>
            <p>  ├─ 种子商店：开放</p>
            <p>  ├─ 公告板：开放</p>
            <p>  ├─ 铁匠铺：暂未开放</p>
            <p>  ├─ 医馆：暂未开放</p>
            <p>  └─ 居民房：暂未开放</p>
          </div>
          <p className="mt-4 text-base leading-8 text-slate-700">
            其他设施先保留建筑外观和门口提示，后续新增功能时只需要扩展地图对象和场景。
          </p>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Tech Stack</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
              技术选择
            </h2>
          </div>
          <Link
            href="/games"
            className="inline-flex w-fit items-center rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            返回游戏入口
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {stackItems.map((item) => (
            <article
              key={item.name}
              className="rounded-[0.75rem] border border-slate-900/10 bg-slate-50 p-4"
            >
              <h3 className="text-xl font-semibold text-slate-950">{item.name}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">{item.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Systems</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            核心系统
          </h2>
          <div className="mt-5 divide-y divide-slate-200">
            {coreSystems.map((system) => (
              <article key={system.title} className="py-4 first:pt-0 last:pb-0">
                <h3 className="text-lg font-semibold text-slate-950">{system.title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-700">{system.text}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Scenes</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            Phaser 场景划分
          </h2>
          <div className="mt-5 space-y-4">
            {scenes.map((scene) => (
              <article
                key={scene.name}
                className="grid gap-2 rounded-[0.75rem] border border-slate-900/10 bg-slate-50 p-4 sm:grid-cols-[9rem_minmax(0,1fr)]"
              >
                <h3 className="font-mono text-sm font-semibold text-emerald-800">
                  {scene.name}
                </h3>
                <p className="text-sm leading-7 text-slate-700">{scene.purpose}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Assets</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            第一批美术资产
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {assets.map((asset) => (
              <div
                key={asset}
                className="rounded-[0.75rem] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm leading-7 text-slate-700"
              >
                {asset}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Animation</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
            动画先做手感
          </h2>
          <p className="mt-5 text-base leading-8 text-slate-700">
            第一版使用 spritesheet 做角色、作物、商店和公告板，用 Tween 做收获弹跳、金币变化、NPC 移动、雨滴、雾气、场景淡入淡出和工具反馈。交互层改为面前地块高亮、E 键提示和底部对话框，动物和节日特效放到第二阶段。
          </p>
          <div className="mt-5 rounded-[0.75rem] bg-emerald-950 p-5 text-sm leading-7 text-emerald-50">
            性能原则：作物成长只在睡觉时计算，地图从 Tiled JSON 读取，图片合成 spritesheet，天气粒子短时播放，目标桌面浏览器 60 FPS，低配设备可稳定 30 FPS。
          </div>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Roadmap</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
          四周开发路线
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {milestones.map((item) => (
            <article
              key={item.phase}
              className="rounded-[0.75rem] border border-slate-900/10 bg-slate-50 p-4"
            >
              <h3 className="text-lg font-semibold text-slate-950">{item.phase}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-700">{item.target}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-slate-900/10 bg-slate-950 p-6 text-white shadow-[0_24px_80px_-55px_rgba(15,23,42,0.7)]">
        <p className="text-sm uppercase tracking-[0.22em] text-slate-300">Next Build</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">下一步迭代方向</h2>
        <p className="mt-4 max-w-4xl text-base leading-8 text-slate-200">
          现在已经完成独立游戏目录、Phaser + TypeScript + Vite 构建、Tiled JSON 地图、NPC、天气、体力、时间、公告板订单、底部图标工具栏、作物 logo、木质 HUD、对话框、第一批像素 spritesheet 和博客嵌入。下一轮可以继续做工具动作帧、NPC 礼物、室内扩建和 Tiled 编辑器内的地图扩建。
        </p>
      </section>
    </main>
  );
}
