export const ARTICLE_AI_CHAT_OPEN_EVENT = "article-ai-chat:open";

export type ArticleAiChatOpenDetail = {
  context?: string;
  prompt?: string;
  selection?: string;
  slug?: string;
  title?: string;
};
