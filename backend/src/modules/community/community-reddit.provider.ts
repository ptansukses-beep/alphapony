import { Injectable, Logger } from "@nestjs/common";
import Parser = require("rss-parser");
import {
  COMMUNITY_REDDIT_FEEDS,
  COMMUNITY_REDDIT_LIMIT_PER_FEED,
  COMMUNITY_REDDIT_USER_AGENT
} from "./community.constants";
import { detectCommunitySymbols } from "./community.utils";
import type { CommunityPost, SupportedCommunitySymbol } from "./community.types";

type RedditListing = {
  data?: {
    children?: Array<{
      data?: {
        id?: string;
        title?: string;
        selftext?: string;
        created_utc?: number;
        score?: number;
        num_comments?: number;
        upvote_ratio?: number;
        url?: string;
        permalink?: string;
      };
    }>;
  };
};

@Injectable()
export class CommunityRedditProvider {
  private readonly logger = new Logger(CommunityRedditProvider.name);
  private readonly parser = new Parser({
    timeout: 12_000,
    headers: {
      "user-agent": COMMUNITY_REDDIT_USER_AGENT
    }
  });

  async fetchPosts() {
    const settled = await Promise.allSettled(
      COMMUNITY_REDDIT_FEEDS.map(async (feed) => {
        const url = new URL(`https://www.reddit.com/r/${feed.subreddit}/${feed.feedType}.json`);
        url.searchParams.set("limit", String(COMMUNITY_REDDIT_LIMIT_PER_FEED));
        url.searchParams.set("raw_json", "1");

        const response = await fetch(url, {
          headers: {
            "user-agent": COMMUNITY_REDDIT_USER_AGENT
          },
          signal: AbortSignal.timeout(12_000),
          cache: "no-store"
        });

        if (!response.ok) {
          if (response.status === 403) {
            return this.fetchFeedFromRss(feed.subreddit, feed.feedType, feed.weight, feed.symbol);
          }

          throw new Error(`Reddit ${feed.subreddit}/${feed.feedType} failed: ${response.status}`);
        }

        const payload = (await response.json()) as RedditListing;
        const items = payload.data?.children ?? [];

        return items.flatMap((item) => {
          const data = item.data;
          if (!data?.id || !data.title) {
            return [];
          }

          const title = data.title.trim();
          const body = (data.selftext ?? "").trim();
          const matchedSymbols = feed.symbol
            ? [feed.symbol]
            : detectCommunitySymbols(`${title}\n${body}`);

          if (matchedSymbols.length === 0) {
            return [];
          }

          return [
            {
              id: `${feed.subreddit}:${data.id}`,
              source: "reddit",
              subreddit: feed.subreddit,
              feedType: feed.feedType,
              title,
              body,
              url: String(data.url ?? `https://www.reddit.com${data.permalink ?? ""}`),
              permalink: `https://www.reddit.com${String(data.permalink ?? "")}`,
              publishedAt: new Date((data.created_utc ?? Date.now() / 1000) * 1000).toISOString(),
              score: Number(data.score ?? 0),
              numComments: Number(data.num_comments ?? 0),
              upvoteRatio:
                typeof data.upvote_ratio === "number" ? Number(data.upvote_ratio) : null,
              matchedSymbols: matchedSymbols as SupportedCommunitySymbol[],
              sourceWeight: feed.weight
            } satisfies CommunityPost
          ];
        });
      })
    );

    const deduped = new Map<string, CommunityPost>();

    settled.forEach((result) => {
      if (result.status === "rejected") {
        this.logger.warn(result.reason instanceof Error ? result.reason.message : String(result.reason));
        return;
      }

      result.value.forEach((item) => {
        const existing = deduped.get(item.id);
        if (!existing || existing.feedType === "new") {
          deduped.set(item.id, item);
        }
      });
    });

    return [...deduped.values()];
  }

  private async fetchFeedFromRss(
    subreddit: string,
    feedType: "hot" | "new",
    weight: number,
    symbol?: SupportedCommunitySymbol
  ) {
    const payload = await this.parser.parseURL(`https://www.reddit.com/r/${subreddit}/${feedType}/.rss`);

    return (payload.items ?? [])
      .slice(0, COMMUNITY_REDDIT_LIMIT_PER_FEED)
      .flatMap((item) => {
        if (!item.link || !item.title) {
          return [];
        }

        const title = item.title.trim();
        const body = String(item.contentSnippet ?? item.content ?? "").trim();
        const matchedSymbols = symbol ? [symbol] : detectCommunitySymbols(`${title}\n${body}`);

        if (matchedSymbols.length === 0) {
          return [];
        }

        return [
          {
            id: `${subreddit}:${item.guid ?? item.link}`,
            source: "reddit",
            subreddit,
            feedType,
            title,
            body,
            url: item.link,
            permalink: item.link,
            publishedAt: new Date(item.isoDate ?? item.pubDate ?? Date.now()).toISOString(),
            score: 0,
            numComments: 0,
            upvoteRatio: null,
            matchedSymbols: matchedSymbols as SupportedCommunitySymbol[],
            sourceWeight: weight
          } satisfies CommunityPost
        ];
      });
  }
}
