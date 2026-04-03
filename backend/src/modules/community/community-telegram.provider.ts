import { Injectable, Logger } from "@nestjs/common";
import Parser = require("rss-parser");
import { detectCommunitySymbols } from "./community.utils";
import type { CommunityPost, SupportedCommunitySymbol } from "./community.types";

type TelegramSource = {
  key: string;
  chatUsername: string;
  weight: number;
  symbol?: SupportedCommunitySymbol;
};

const DEFAULT_TELEGRAM_COMMUNITY_SOURCES =
  "solana|solana_announcements|1.8|SOL;binance|binance_announcements|1.6;wublockchain|WuBlockchain|1.4;cointelegraph|Cointelegraph|1.2;ethdaily|ethdaily|1.2|ETH";

@Injectable()
export class CommunityTelegramProvider {
  private readonly logger = new Logger(CommunityTelegramProvider.name);
  private readonly parser = new Parser({
    timeout: 12_000,
    headers: {
      "user-agent": "alphapony-community-ingestor/0.1"
    }
  });

  async fetchPosts() {
    const sources = this.getSources();
    if (sources.length === 0) {
      return [];
    }

    const settled = await Promise.allSettled(
      sources.map(async (source) => {
        const rssItems = await this.fetchFromRssHub(source);
        if (rssItems.length > 0) {
          return rssItems;
        }

        return this.fetchFromPublicPage(source);
      })
    );

    const deduped = new Map<string, CommunityPost>();

    settled.forEach((result) => {
      if (result.status === "rejected") {
        this.logger.warn(result.reason instanceof Error ? result.reason.message : String(result.reason));
        return;
      }

      result.value.forEach((item) => {
        if (!deduped.has(item.id)) {
          deduped.set(item.id, item);
        }
      });
    });

    return [...deduped.values()];
  }

  private async fetchFromRssHub(source: TelegramSource) {
    const baseUrl = (process.env.RSSHUB_BASE_URL ?? "https://rsshub.app").replace(/\/$/, "");
    const feedUrl = `${baseUrl}/telegram/channel/${source.chatUsername}`;

    try {
      const payload = await this.parser.parseURL(feedUrl);
      return (payload.items ?? [])
        .slice(0, 25)
        .flatMap((item) => this.toPost(item.title ?? "", item.contentSnippet ?? item.content ?? "", item.link ?? "", item.isoDate ?? item.pubDate ?? "", source, "rsshub"));
    } catch (error) {
      this.logger.warn(
        `Telegram RSSHub ${source.chatUsername} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  private async fetchFromPublicPage(source: TelegramSource) {
    try {
      const response = await fetch(`https://t.me/s/${source.chatUsername}`, {
        headers: {
          "user-agent": "alphapony-community-ingestor/0.1"
        },
        signal: AbortSignal.timeout(12_000),
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const blocks = html.split('tgme_widget_message_wrap').slice(1, 26);

      return blocks.flatMap((block, index) => {
        const text = this.extract(block, /tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i);
        const date = this.extract(block, /datetime="([^"]+)"/i);
        const link = this.extract(block, /tgme_widget_message_date[^>]*href="([^"]+)"/i);

        return this.toPost(
          this.stripHtml(text).split("\n").find(Boolean) ?? `Telegram post ${index + 1}`,
          this.stripHtml(text),
          link,
          date,
          source,
          "public-page"
        );
      });
    } catch (error) {
      this.logger.warn(
        `Telegram public page ${source.chatUsername} failed: ${error instanceof Error ? error.message : String(error)}`
      );
      return [];
    }
  }

  private toPost(
    titleRaw: string,
    bodyRaw: string,
    link: string,
    publishedAt: string,
    source: TelegramSource,
    sourceType: "rsshub" | "public-page"
  ) {
    const title = this.stripHtml(titleRaw).trim();
    const body = this.stripHtml(bodyRaw).trim();
    const text = `${title}\n${body}`.trim();

    if (!text) {
      return [];
    }

    const matchedSymbols = source.symbol ? [source.symbol] : detectCommunitySymbols(text);
    if (matchedSymbols.length === 0) {
      return [];
    }

    return [
      {
        id: `telegram:${source.key}:${link || title}:${sourceType}`,
        source: "telegram",
        subreddit: source.chatUsername,
        feedType: "new",
        title: title || body.slice(0, 160),
        body,
        url: link || `https://t.me/s/${source.chatUsername}`,
        permalink: link || `https://t.me/s/${source.chatUsername}`,
        publishedAt: publishedAt ? new Date(publishedAt).toISOString() : new Date().toISOString(),
        score: 0,
        numComments: 0,
        upvoteRatio: null,
        matchedSymbols,
        sourceWeight: source.weight
      } satisfies CommunityPost
    ];
  }

  private getSources() {
    const raw = DEFAULT_TELEGRAM_COMMUNITY_SOURCES;

    return raw
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .flatMap((entry) => {
        const [key, chatUsername, weightRaw, symbolRaw] = entry.split("|").map((item) => item.trim());
        if (!key || !chatUsername) {
          return [];
        }

        return [
          {
            key,
            chatUsername: chatUsername.replace(/^@/, ""),
            weight: Number(weightRaw || 1.3) || 1.3,
            symbol: symbolRaw ? (symbolRaw.toUpperCase() as SupportedCommunitySymbol) : undefined
          } satisfies TelegramSource
        ];
      });
  }

  private extract(value: string, pattern: RegExp) {
    return pattern.exec(value)?.[1] ?? "";
  }

  private stripHtml(value: string) {
    return value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim();
  }
}
