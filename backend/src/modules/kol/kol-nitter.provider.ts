import { Injectable, Logger } from "@nestjs/common";
import Parser = require("rss-parser");
import {
  DEFAULT_KOL_ACCOUNTS,
  DEFAULT_NITTER_BASE_URLS,
  KOL_FETCH_CONCURRENCY,
  KOL_INSTANCE_RETRY_COUNT,
  KOL_WATCHLIST_BATCH_SIZE
} from "./kol.constants";
import { detectKolSymbols } from "./kol.utils";
import type { KolAuthorTier, KolPost, SupportedKolSymbol } from "./kol.types";

type KolAccount = {
  username: string;
  weight: number;
  symbol?: SupportedKolSymbol;
  tier: KolAuthorTier;
};

@Injectable()
export class KolNitterProvider {
  private readonly logger = new Logger(KolNitterProvider.name);
  private readonly parser = new Parser({
    timeout: 12_000,
    headers: {
      "user-agent": "alphapony-kol-ingestor/0.1"
    }
  });
  private preferredBaseUrl: string | null = null;

  async fetchPosts() {
    const baseUrls = this.getBaseUrls();
    const accounts = this.selectAccountsForCurrentWindow(this.getAccounts());

    const settled = await this.mapConcurrent(accounts, KOL_FETCH_CONCURRENCY, async (account) =>
      Promise.allSettled([
        (async () => {
        const payload = await this.fetchFeed(account.username, baseUrls);

        return (payload.items ?? [])
          .slice(0, 12)
          .flatMap((item) => {
            const title = String(item.title ?? "").trim();
            const body = String(item.contentSnippet ?? item.content ?? "").trim();
            const text = `${title}\n${body}`.trim();
            if (!text || /RSS reader not yet whitelisted/i.test(text)) {
              return [];
            }

            const matchedSymbols = account.symbol ? [account.symbol] : detectKolSymbols(text);
            if (matchedSymbols.length === 0) {
              return [];
            }

            return [
              {
                id: `${account.username}:${item.guid ?? item.link ?? title}`,
                author: account.username,
                title: title || body.slice(0, 160),
                body,
                publishedAt: new Date(item.isoDate ?? item.pubDate ?? Date.now()).toISOString(),
                url: this.toXUrl(account.username, item.link),
                matchedSymbols,
                authorWeight: account.weight,
                authorTier: account.tier
              } satisfies KolPost
            ];
          });
        })()
      ]).then(([result]) => result)
    );

    const deduped = new Map<string, KolPost>();

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

  private async fetchFeed(username: string, baseUrls: string[]) {
    let lastError: unknown = null;

    for (const baseUrl of this.prioritizeBaseUrls(baseUrls)) {
      for (let attempt = 0; attempt <= KOL_INSTANCE_RETRY_COUNT; attempt += 1) {
        const feedUrl = `${baseUrl}/${username}/rss`;

        try {
          const payload = await this.parser.parseURL(feedUrl);
          this.preferredBaseUrl = baseUrl;
          return payload;
        } catch (error) {
          lastError = error;
          this.logger.warn(
            `Failed to fetch ${username} from ${baseUrl} (attempt ${attempt + 1}/${KOL_INSTANCE_RETRY_COUNT + 1}): ${
              error instanceof Error ? error.message : String(error)
            }`
          );

          if (attempt < KOL_INSTANCE_RETRY_COUNT) {
            await this.delay(350 * (attempt + 1));
          }
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${username} from all configured Nitter instances`);
  }

  private selectAccountsForCurrentWindow(accounts: KolAccount[]) {
    const coreAccounts = accounts.filter((account) => account.tier === "core");
    const watchlistAccounts = accounts.filter((account) => account.tier === "watchlist");

    if (watchlistAccounts.length === 0) {
      return coreAccounts;
    }

    const batchSize = Math.max(1, KOL_WATCHLIST_BATCH_SIZE);
    const windowIndex = Math.floor(Date.now() / 600_000);
    const offset = (windowIndex * batchSize) % watchlistAccounts.length;
    const selectedWatchlist = Array.from({ length: Math.min(batchSize, watchlistAccounts.length) }, (_, index) => {
      return watchlistAccounts[(offset + index) % watchlistAccounts.length];
    });

    return [...coreAccounts, ...selectedWatchlist];
  }

  private prioritizeBaseUrls(baseUrls: string[]) {
    if (!this.preferredBaseUrl || !baseUrls.includes(this.preferredBaseUrl)) {
      return baseUrls;
    }

    return [this.preferredBaseUrl, ...baseUrls.filter((item) => item !== this.preferredBaseUrl)];
  }

  private getBaseUrls() {
    return [...DEFAULT_NITTER_BASE_URLS];
  }

  private getAccounts() {
    const raw = process.env.KOL_ACCOUNTS?.trim() ?? "";
    if (!raw) {
      return [...DEFAULT_KOL_ACCOUNTS] as KolAccount[];
    }

    return raw
      .split(";")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .flatMap((entry) => {
        const [username, weightRaw, symbolRaw] = entry.split("|").map((item) => item.trim());
        if (!username) {
          return [];
        }

        return [
          {
            username: username.replace(/^@/, ""),
            weight: Number(weightRaw || 1.2) || 1.2,
            symbol: symbolRaw ? (symbolRaw.toUpperCase() as SupportedKolSymbol) : undefined,
            tier: "watchlist"
          } satisfies KolAccount
        ];
      });
  }

  private toXUrl(username: string, rawUrl?: string | null) {
    const fallbackUrl = `https://x.com/${username.replace(/^@/, "")}`;

    if (!rawUrl) {
      return fallbackUrl;
    }

    try {
      const parsed = new URL(rawUrl);
      const segments = parsed.pathname.split("/").filter(Boolean);
      const normalizedUsername = segments[0]?.replace(/^@/, "") || username.replace(/^@/, "");
      const statusIndex = segments.findIndex((segment) => segment === "status");
      const statusId = statusIndex >= 0 ? segments[statusIndex + 1] : null;

      if (statusId) {
        return `https://x.com/${normalizedUsername}/status/${statusId}`;
      }

      return `https://x.com/${normalizedUsername}`;
    } catch {
      return fallbackUrl;
    }
  }

  private async mapConcurrent<TInput, TOutput>(
    items: TInput[],
    concurrency: number,
    mapper: (item: TInput) => Promise<TOutput>
  ) {
    const results = new Array<TOutput>(items.length);
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const currentIndex = nextIndex;
        nextIndex += 1;

        if (currentIndex >= items.length) {
          return;
        }

        results[currentIndex] = await mapper(items[currentIndex]);
      }
    };

    await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => worker()));

    return results;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
