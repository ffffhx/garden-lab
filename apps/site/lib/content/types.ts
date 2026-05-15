export type CategoryKey = "tech" | "fitness" | "dailyNews";

export type CategoryDefinition = {
  key: CategoryKey;
  slug: string;
  label: string;
  description: string;
};

export type Heading = {
  id: string;
  text: string;
  depth: 2 | 3 | 4;
};

export type CoverPosition = "above-title" | "below-title";

export type PostSummary = {
  slug: string;
  title: string;
  excerpt: string;
  categories: CategoryKey[];
  tags: string[];
  date: Date;
  dateText: string;
  readingTimeText: string;
  assetBasePath: string;
  cover: string | null;
  coverPosition: CoverPosition;
};

export type PostCardSummary = Omit<PostSummary, "date">;

export type Post = PostSummary & {
  content: string;
  contentHtml: string;
  headings: Heading[];
  sourcePath: string;
};

export type PageContent = {
  title: string;
  date: Date | null;
  content: string;
  contentHtml: string;
  headings: Heading[];
};

export type CategoryCollection = CategoryDefinition & {
  posts: PostSummary[];
};
