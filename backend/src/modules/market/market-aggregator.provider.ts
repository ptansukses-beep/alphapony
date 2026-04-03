import { Injectable, Logger } from "@nestjs/common";
import { SUPPORTED_MARKET_ASSETS } from "./market.constants";
import type { AggregatedMarketSnapshot } from "./market.types";

type CoinGeckoMarketItem = {
  id: string;
  name: string;
  image: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  market_cap_rank: number | null;
  last_updated: string;
};

@Injectable()
export class MarketAggregatorProvider {
  private readonly logger = new Logger(MarketAggregatorProvider.name);

  async getMarkets(): Promise<Map<string, AggregatedMarketSnapshot>> {
    const ids = SUPPORTED_MARKET_ASSETS.map((asset) => asset.coinGeckoId).join(",");
    const apiKey = process.env.COINGECKO_DEMO_API_KEY;
    const query = new URLSearchParams({
      vs_currency: "usd",
      ids,
      price_change_percentage: "24h"
    });

    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/coins/markets?${query.toString()}`,
        {
          headers: apiKey
            ? {
                "x-cg-demo-api-key": apiKey
              }
            : undefined,
          cache: "no-store"
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko request failed: ${response.status} ${response.statusText}`);
      }

      const items = (await response.json()) as CoinGeckoMarketItem[];
      const byId = new Map(items.map((item) => [item.id, item]));

      return new Map(
        SUPPORTED_MARKET_ASSETS.flatMap((asset) => {
          const item = byId.get(asset.coinGeckoId);

          if (!item) {
            return [];
          }

          return [
            [
              asset.symbol,
              {
                symbol: asset.symbol,
                name: item.name,
                image: item.image,
                marketCapRank: item.market_cap_rank ?? undefined,
                price: this.formatPrice(item.current_price),
                priceChange: this.formatChange(item.price_change_percentage_24h),
                timestamp: item.last_updated
              }
            ] as const
          ];
        })
      );
    } catch (error) {
      this.logger.warn(
        `CoinGecko market fetch failed, continuing without aggregator overlay. ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );

      return new Map();
    }
  }

  private formatPrice(value: number | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return undefined;
    }

    if (value >= 1000) {
      return `$${value.toLocaleString("en-US", {
        maximumFractionDigits: 0
      })}`;
    }

    if (value >= 1) {
      return `$${value.toLocaleString("en-US", {
        minimumFractionDigits: value < 100 ? 2 : 1,
        maximumFractionDigits: 2
      })}`;
    }

    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 3,
      maximumFractionDigits: 4
    })}`;
  }

  private formatChange(value: number | null | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return undefined;
    }

    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  }
}
