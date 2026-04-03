import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NEWS_CACHE_TTL_MS, NEWS_GUARDIAN_PRESETS } from "./news.constants";
import { ListNewsOptions, NewsItem } from "./news.types";
import {
  canonicalUrl,
  categoryLabel,
  classifyNewsCategory,
  detectSymbols,
  stripHtml,
  uniqueNewsKey
} from "./news.utils";

type GuardianResult = {
  webTitle?: string;
  webUrl?: string;
  webPublicationDate?: string;
  sectionName?: string;
  fields?: {
    trailText?: string;
  };
};

@Injectable()
export class NewsGuardianProvider {
  private readonly logger = new Logger(NewsGuardianProvider.name);
  private readonly cache = new Map<string, { expiresAt: number; data: NewsItem[] }>();

  constructor(private readonly configService: ConfigService) {}

  async fetchNews(options: ListNewsOptions) {
    if (options.category === "asset_specific") {
      return [];
    }

    const presetQueries = this.buildQueries(options.category);
    const items: NewsItem[] = [];

    for (const { category, query, section } of presetQueries) {
      const batch = await this.fetchQuery(query, category, section, Math.max(4, options.limit));
      items.push(...batch);
    }

    return items;
  }

  private async fetchQuery(
    query: string,
    category: NonNullable<ListNewsOptions["category"]>,
    section: string,
    pageSize: number
  ) {
    const url = new URL("https://content.guardianapis.com/search");
    url.searchParams.set("q", query);
    url.searchParams.set("section", section);
    url.searchParams.set("page-size", String(pageSize));
    url.searchParams.set("order-by", "newest");
    url.searchParams.set("show-fields", "trailText");
    url.searchParams.set("api-key", this.apiKey);
    const cacheKey = url.toString();
    const cached = this.cache.get(cacheKey);

    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(12_000),
        headers: {
          "user-agent": "alphapony-news-ingestor/0.1"
        }
      });

      if (!response.ok) {
        throw new Error(`Guardian request failed: ${response.status}`);
      }

      const payload = (await response.json()) as {
        response?: {
          results?: GuardianResult[];
        };
      };

      const data = (payload.response?.results ?? [])
        .map<NewsItem | null>((item) => {
          if (!item.webTitle || !item.webUrl) {
            return null;
          }

          const summary = stripHtml(item.fields?.trailText ?? "");
          const text = `${item.webTitle} ${summary}`;
          const itemCategory = classifyNewsCategory(text, category);

          return {
            id: uniqueNewsKey(item.webTitle, item.webUrl),
            title: item.webTitle.trim(),
            url: canonicalUrl(item.webUrl),
            source: "The Guardian",
            sourceType: "guardian",
            publishedAt: new Date(item.webPublicationDate ?? Date.now()).toISOString(),
            summary,
            category: itemCategory,
            categoryLabel: categoryLabel(itemCategory),
            symbols: detectSymbols(text),
            language: "English"
          };
        })
        .filter((item): item is NewsItem => Boolean(item));

      this.cache.set(cacheKey, {
        expiresAt: Date.now() + NEWS_CACHE_TTL_MS,
        data
      });

      return data;
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : String(error));
      return [];
    }
  }

  private buildQueries(category?: ListNewsOptions["category"]) {
    const items: Array<{
      category: NonNullable<ListNewsOptions["category"]>;
      query: string;
      section: string;
    }> = [];

    if (!category || category === "macro_politics") {
      items.push({
        category: "macro_politics",
        query: NEWS_GUARDIAN_PRESETS.macro_politics,
        section: "politics"
      });
    }

    if (!category || category === "macro_finance") {
      items.push({
        category: "macro_finance",
        query: NEWS_GUARDIAN_PRESETS.macro_finance,
        section: "business"
      });
    }

    return items;
  }

  private get apiKey() {
    return this.configService.get<string>("GUARDIAN_API_KEY") ?? "test";
  }
}
