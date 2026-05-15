export function normalizeTitleSearchQuery(query: string) {
  return query.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function filterPostsByTitle<T extends { title: string }>(
  posts: T[],
  query: string
) {
  const normalizedQuery = normalizeTitleSearchQuery(query);

  if (!normalizedQuery) {
    return [];
  }

  const terms = normalizedQuery.split(" ");

  return posts.filter((post) => {
    const title = post.title.toLocaleLowerCase();
    return terms.every((term) => title.includes(term));
  });
}
