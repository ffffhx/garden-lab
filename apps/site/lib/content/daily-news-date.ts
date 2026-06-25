function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDailyNewsDateSlug(date: Date) {
  return [
    date.getFullYear(),
    padDatePart(date.getMonth() + 1),
    padDatePart(date.getDate()),
  ].join("-");
}

export function isDailyNewsIssueTitle(title: string) {
  return /^每日新闻[：:]/.test(title.trim());
}

export function extractDailyNewsIssueDateSlug(title: string) {
  return title.match(/每日新闻[：:]\s*(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

export function getDailyNewsIssueDateSlug(title: string, date: Date) {
  return extractDailyNewsIssueDateSlug(title) ?? formatDailyNewsDateSlug(date);
}
