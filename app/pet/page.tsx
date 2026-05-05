import type { Metadata } from "next";
import Link from "next/link";

import type {
  BlogPetAchievementLayer,
  BlogPetAppearance,
  BlogPetAttribute,
  BlogPetStats,
} from "@/lib/content/blog-pet";
import { readBlogPetSnapshot } from "@/lib/content/blog-pet-snapshot";

export const metadata: Metadata = {
  title: "博客桌宠",
  description: "博客桌宠的等级、属性、投喂历史和成就记录。",
};

function radarPoint(index: number, ratio: number) {
  const angle = -Math.PI / 2 + index * ((Math.PI * 2) / 3);
  const radius = 78 * Math.max(0.08, Math.min(1, ratio));

  return `${110 + Math.cos(angle) * radius},${110 + Math.sin(angle) * radius}`;
}

function PetRadar({ attributes }: { attributes: BlogPetAttribute[] }) {
  const points = attributes.map((attribute, index) => radarPoint(index, attribute.ratio)).join(" ");
  const axisPoints = attributes.map((_, index) => radarPoint(index, 1));

  return (
    <svg viewBox="0 0 220 220" role="img" aria-label="桌宠属性雷达图" className="h-64 w-full">
      <polygon points={axisPoints.join(" ")} fill="rgba(255,255,255,0.55)" stroke="rgba(15,23,42,0.14)" />
      {[0.35, 0.68].map((ratio) => (
        <polygon
          key={ratio}
          points={attributes.map((_, index) => radarPoint(index, ratio)).join(" ")}
          fill="none"
          stroke="rgba(15,23,42,0.1)"
        />
      ))}
      {axisPoints.map((point, index) => {
        const [x, y] = point.split(",").map(Number);

        return (
          <line
            key={attributes[index].id}
            x1="110"
            y1="110"
            x2={x}
            y2={y}
            stroke="rgba(15,23,42,0.12)"
          />
        );
      })}
      <polygon points={points} fill="rgba(180,83,9,0.28)" stroke="#b45309" strokeWidth="3" />
      {axisPoints.map((point, index) => {
        const [x, y] = point.split(",").map(Number);

        return (
          <text
            key={attributes[index].id}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-slate-700 text-[12px] font-bold"
          >
            {attributes[index].label}
          </text>
        );
      })}
    </svg>
  );
}

function progressPercent(ratio: number) {
  return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

function nextLevelLine(pet: BlogPetStats) {
  if (pet.nextLevelXp === undefined) {
    return "已经满级，后续可以继续解锁更多写作成就。";
  }

  return `距离 Lv.${pet.level + 1} 还差 ${Math.max(0, pet.nextLevelXp - pet.xp)} XP。`;
}

const achievementLayerLabels: Record<BlogPetAchievementLayer, string> = {
  continuity: "写作连续性",
  balance: "分类均衡",
  category: "分类路线",
  longform: "长文数量",
  series: "系列文章",
  annual: "年度回顾",
};

function groupAchievements(pet: BlogPetStats) {
  return pet.achievements.reduce(
    (groups, achievement) => {
      groups[achievement.layer].push(achievement);

      return groups;
    },
    {
      continuity: [],
      balance: [],
      category: [],
      longform: [],
      series: [],
      annual: [],
    } as Record<BlogPetAchievementLayer, BlogPetStats["achievements"]>
  );
}

function MiniPetSprite({
  appearance,
  currentEvolutionId,
}: {
  appearance: BlogPetAppearance;
  currentEvolutionId: BlogPetStats["evolution"]["id"];
}) {
  return (
    <div
      className={`blog-pet-avatar blog-pet--form-${appearance.formLevel} blog-pet--phase-${appearance.phase} blog-pet--evolution-${currentEvolutionId} ${
        appearance.current ? "blog-pet-avatar--current" : ""
      } ${appearance.unlocked ? "" : "blog-pet-avatar--locked"}`}
    >
      <span className="blog-pet__sprite-button" aria-hidden="true">
        <span className="blog-pet__aura" />
        <span className="blog-pet__sprite">
          <span className="blog-pet__tail" />
          <span className="blog-pet__cape" />
          <span className="blog-pet__leg blog-pet__leg--left" />
          <span className="blog-pet__leg blog-pet__leg--right" />
          <span className="blog-pet__arm blog-pet__arm--left" />
          <span className="blog-pet__arm blog-pet__arm--right" />
          <span className="blog-pet__ear blog-pet__ear--left" />
          <span className="blog-pet__ear blog-pet__ear--right" />
          <span className="blog-pet__horn blog-pet__horn--left" />
          <span className="blog-pet__horn blog-pet__horn--right" />
          <span className="blog-pet__wing blog-pet__wing--left" />
          <span className="blog-pet__wing blog-pet__wing--right" />
          <span className="blog-pet__mane" />
          <span className="blog-pet__crest" />
          <span className="blog-pet__scarf" />
          <span className="blog-pet__mask" />
          <span className="blog-pet__glasses" />
          <span className="blog-pet__book" />
          <span className="blog-pet__artifact" />
          <span className="blog-pet__weapon" />
          <span className="blog-pet__face">
            <span className="blog-pet__eye blog-pet__eye--left" />
            <span className="blog-pet__eye blog-pet__eye--right" />
            <span className="blog-pet__mouth" />
          </span>
          <span className="blog-pet__belly" />
          <span className="blog-pet__paw blog-pet__paw--left" />
          <span className="blog-pet__paw blog-pet__paw--right" />
        </span>
        <span className="blog-pet__food-chip">{appearance.level === 0 ? "START" : `Lv.${appearance.level}`}</span>
      </span>
    </div>
  );
}

export default function PetPage() {
  const snapshot = readBlogPetSnapshot();
  const pet = snapshot.pet;
  const recentMeals = pet.mealLog.slice(0, 6);
  const timeline = pet.growthTimeline.slice(0, 18);
  const achievementGroups = groupAchievements(pet);
  const activeTask = pet.tasks.find((task) => !task.completed) ?? pet.tasks[0];

  return (
    <main className="space-y-7">
      <section className="overflow-hidden rounded-[1.5rem] border border-slate-900/10 bg-slate-950 text-white shadow-[0_32px_110px_-64px_rgba(15,23,42,0.9)]">
        <div className="grid gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:px-8">
          <div className="space-y-5">
            <p className="text-sm uppercase tracking-[0.24em] text-amber-200">Blog Pet Archive</p>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                {pet.stage.name} · Lv.{pet.level}
              </h1>
              <p className="mt-3 max-w-3xl text-base leading-8 text-slate-200">
                {pet.evolution.label}，{pet.evolution.description}
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-100/85">
                第 {pet.stage.formLevel}/10 形态 · {pet.stage.phase}/5 阶 · {pet.stage.growthHint}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[0.75rem] border border-white/12 bg-white/10 px-4 py-3">
                <span className="text-xs font-semibold text-white/62">总投喂</span>
                <strong className="mt-1 block text-2xl">{pet.totalMeals} 篇</strong>
              </div>
              <div className="rounded-[0.75rem] border border-white/12 bg-white/10 px-4 py-3">
                <span className="text-xs font-semibold text-white/62">连续投喂</span>
                <strong className="mt-1 block text-2xl">{pet.streakDays} 天</strong>
              </div>
              <div className="rounded-[0.75rem] border border-white/12 bg-white/10 px-4 py-3">
                <span className="text-xs font-semibold text-white/62">饱腹状态</span>
                <strong className="mt-1 block text-2xl">{pet.hunger.label}</strong>
              </div>
            </div>
          </div>

          <div className="rounded-[1rem] border border-white/12 bg-white/10 p-5">
            <p className="text-sm font-semibold text-white/62">下一阶段</p>
            <h2 className="mt-2 text-2xl font-semibold">{pet.nextFocus.label}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-200">{pet.nextFocus.detail}</p>
            <p className="mt-4 text-sm text-white/62">{nextLevelLine(pet)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Form Atlas</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">0-50 级形象图谱</h2>
          </div>
          <p className="max-w-xl text-sm leading-7 text-slate-600">
            每 5 级进入一个稳定形象，当前阶段会高亮；未解锁形象先以低饱和状态预览。
          </p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          {pet.appearanceMap.map((appearance) => (
            <article
              key={appearance.level}
              className={`rounded-[0.9rem] border p-4 ${
                appearance.current
                  ? "border-amber-300 bg-amber-50"
                  : appearance.unlocked
                    ? "border-slate-900/10 bg-slate-50"
                    : "border-slate-900/10 bg-white/70"
              }`}
            >
              <MiniPetSprite appearance={appearance} currentEvolutionId={pet.evolution.id} />
              <p className="mt-3 text-sm font-semibold text-slate-500">
                {appearance.level === 0 ? "Lv.0" : `Lv.${appearance.level - 4}-${appearance.level}`}
              </p>
              <h3 className="mt-1 text-lg font-semibold text-slate-950">{appearance.name}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-700">{appearance.phaseLabel} · {appearance.title}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Next Quests</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">下一步任务</h2>
          {activeTask ? (
            <div className="mt-5 rounded-[0.9rem] border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900">当前优先</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">{activeTask.title}</h3>
              <p className="mt-2 text-sm leading-7 text-slate-700">{activeTask.description}</p>
            </div>
          ) : null}
          <div className="mt-5 space-y-3">
            {pet.tasks.map((task) => (
              <article key={task.id} className="rounded-[0.75rem] border border-slate-900/10 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">{task.completed ? "已完成" : task.progressText}</p>
                    <h3 className="mt-1 text-lg font-semibold text-slate-950">{task.title}</h3>
                  </div>
                  {task.food ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-700">
                      {task.food.shortLabel}
                    </span>
                  ) : null}
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className="block h-full rounded-full bg-amber-700"
                    style={{ width: progressPercent(task.goal === 0 ? 1 : task.progress / task.goal) }}
                  />
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Evolution Routes</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">进化路线</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {pet.evolutionRoutes.map((route) => (
              <article
                key={route.id}
                className={`rounded-[0.85rem] border p-4 ${
                  route.current ? "border-amber-300 bg-amber-50" : "border-slate-900/10 bg-slate-50"
                }`}
              >
                <p className="text-sm font-semibold text-slate-500">{route.current ? "当前路线" : route.progressText}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{route.label} · {route.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">{route.description}</p>
                <p className="mt-3 text-sm font-semibold text-slate-600">外观：{route.visualCue}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">台词：{route.voiceLine}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Attributes</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">属性雷达</h2>
          <PetRadar attributes={pet.attributes} />
          <div className="mt-4 space-y-3">
            {pet.attributes.map((attribute) => (
              <div key={attribute.id}>
                <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                  <span>{attribute.label}</span>
                  <span>
                    {attribute.value} / {attribute.maxValue}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className="block h-full rounded-full bg-amber-700"
                    style={{ width: progressPercent(attribute.ratio) }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Flavor Ledger</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">口味统计</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {pet.foodStats.map((food) => (
              <article key={food.category} className="rounded-[0.75rem] border border-slate-900/10 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">{food.shortLabel}</p>
                <h3 className="mt-2 text-xl font-semibold text-slate-950">{food.label}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-700">
                  {food.count} 篇 · {food.attributeLabel} +{food.attributeGain}
                </p>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                  <span
                    className="block h-full rounded-full bg-slate-950"
                    style={{ width: progressPercent(food.ratio) }}
                  />
                </div>
              </article>
            ))}
          </div>
          <div className="mt-5 rounded-[0.75rem] bg-amber-50 p-4 text-sm leading-7 text-slate-700">
            主属性是 <strong className="text-slate-950">{pet.dominantAttribute.label}</strong>，
            当前外观会优先表现为 {pet.evolution.traitLabel}。
          </div>
        </div>
      </section>

      <section className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
        <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Achievements</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">分层成就墙</h2>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {(Object.keys(achievementLayerLabels) as BlogPetAchievementLayer[]).map((layer) => (
            <section key={layer} className="rounded-[0.95rem] border border-slate-900/10 bg-slate-50 p-4">
              <h3 className="text-lg font-semibold text-slate-950">{achievementLayerLabels[layer]}</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {achievementGroups[layer].map((achievement) => (
                  <article
                    key={achievement.id}
                    className={`rounded-[0.75rem] border p-4 ${
                      achievement.unlocked
                        ? "border-amber-300 bg-amber-50"
                        : "border-slate-900/10 bg-white"
                    }`}
                  >
                    <p className="text-sm font-semibold text-slate-500">
                      {achievement.unlocked ? "已解锁" : achievement.progressText}
                    </p>
                    <h4 className="mt-2 text-base font-semibold text-slate-950">{achievement.title}</h4>
                    <p className="mt-2 text-sm leading-6 text-slate-700">{achievement.description}</p>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Recent Meals</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">最近吃过的文章</h2>
          <div className="mt-5 divide-y divide-slate-200">
            {recentMeals.map((meal) => (
              <Link key={meal.slug} href={`/post/${meal.slug}`} className="block py-4 first:pt-0 hover:text-amber-800">
                <p className="text-sm font-semibold text-slate-500">{meal.dateText}</p>
                <h3 className="mt-1 text-lg font-semibold text-slate-950">{meal.title}</h3>
                <p className="mt-2 text-sm text-slate-700">{meal.summary}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[1.25rem] border border-slate-900/10 bg-white/86 p-6 shadow-[0_24px_80px_-55px_rgba(15,23,42,0.5)]">
          <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Timeline</p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">成长时间线</h2>
          <ol className="mt-5 space-y-4">
            {timeline.map((event) => (
              <li key={`${event.slug}-${event.xp}`} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
                <time className="text-sm font-semibold text-slate-500">{event.dateText}</time>
                <div className="border-l border-slate-200 pl-4">
                  <Link href={`/post/${event.slug}`} className="font-semibold text-slate-950 hover:text-amber-800">
                    {event.title}
                  </Link>
                  <p className="mt-1 text-sm leading-6 text-slate-700">
                    {event.mealSummary} · XP +{event.xpGained} · Lv.{event.previousLevel}
                    {event.previousLevel === event.level ? "" : ` → Lv.${event.level}`} · {event.stageName}
                  </p>
                  {event.unlockedAchievements.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {event.unlockedAchievements.map((achievement) => (
                        <span
                          key={achievement.id}
                          className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900"
                        >
                          解锁：{achievement.title}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
