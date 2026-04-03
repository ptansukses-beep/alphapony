import { Injectable, Logger } from "@nestjs/common";
import Parser = require("rss-parser");
import { NEWS_CACHE_TTL_MS, NEWS_RSS_FEEDS } from "./news.constants";
import { ListNewsOptions, NewsItem } from "./news.types";
import {
  canonicalUrl,
  categoryLabel,
  classifyNewsCategory,
  detectSymbols,
  stripHtml,
  uniqueNewsKey
} from "./news.utils";

@Injectable()
export class NewsRssProvider {
  private readonly logger = new Logger(NewsRssProvider.name);
  private readonly feedCache = new Map<string, { expiresAt: number; data: NewsItem[] }>();
  private readonly parser = new Parser({
    timeout: 12_000,
    headers: {
      "user-agent": "alphapony-news-ingestor/0.1"
    }
  });

  async fetchNews(options: ListNewsOptions) {
    const settled = await Promise.allSettled(
      NEWS_RSS_FEEDS.map(async (feed) => {
        const cached = this.feedCache.get(feed.url);

        if (cached && cached.expiresAt > Date.now()) {
          return cached.data;
        }

        const payload = await this.parser.parseURL(feed.url);
        const data = (payload.items ?? [])
          .slice(0, Math.max(options.limit, 10))
          .map<NewsItem | null>((item) => {
            if (!item.link || !item.title) {
              return null;
            }

            const summary = stripHtml(item.contentSnippet ?? item.content ?? "");
            const text = `${item.title} ${summary}`;
            const category = classifyNewsCategory(text, feed.category);

            return {
              id: uniqueNewsKey(item.title, item.link),
              title: item.title.trim(),
              url: canonicalUrl(item.link),
              source: feed.source,
              sourceType: "rss",
              publishedAt: new Date(item.isoDate ?? item.pubDate ?? Date.now()).toISOString(),
              summary,
              category,
              categoryLabel: categoryLabel(category),
              symbols: detectSymbols(text)
            };
          })
          .filter((item): item is NewsItem => Boolean(item));

        this.feedCache.set(feed.url, {
          expiresAt: Date.now() + NEWS_CACHE_TTL_MS,
          data
        });

        return data;
      })
    );

    return settled.flatMap((result) => {
      if (result.status === "fulfilled") {
        return result.value.filter((item): item is NewsItem => Boolean(item));
      }

      this.logger.warn(result.reason instanceof Error ? result.reason.message : String(result.reason));
      return [];
    });
  }
}
