import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import * as ccxt from "ccxt";
import { SUPPORTED_MARKET_ASSETS } from "./market.constants";
import type { ExchangeTickerSnapshot, MarketOhlcvPoint, MarketSignalInput } from "./market.types";

@Injectable()
export class MarketExchangeProvider implements OnModuleDestroy {
  private readonly logger = new Logger(MarketExchangeProvider.name);
  private readonly exchange = new ccxt.binance({
    enableRateLimit: true,
    options: {
      defaultType: "spot"
    }
  });

  async getTickers(): Promise<Map<string, ExchangeTickerSnapshot>> {
    try {
      const tickers = await Promise.all(
        SUPPORTED_MARKET_ASSETS.map(async (asset) => {
          const ticker = await this.exchange.fetchTicker(asset.binanceSymbol);

          return [
            asset.symbol,
            {
              symbol: asset.symbol,
              price: this.formatPrice(ticker.last),
              priceChange: this.formatChange(ticker.percentage),
              timestamp: new Date(ticker.timestamp ?? Date.now()).toISOString()
            }
          ] as const;
        })
      );

      return new Map(tickers);
    } catch (error) {
      this.logger.warn(
        `CCXT Binance ticker fetch failed, falling back to database values. ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );

      return new Map();
    }
  }

  async getSignalInputs(): Promise<Map<string, MarketSignalInput>> {
    try {
      const entries = await Promise.all(
        SUPPORTED_MARKET_ASSETS.map(async (asset) => {
          const [ticker, candles4hRaw] = await Promise.all([
            this.exchange.fetchTicker(asset.binanceSymbol),
            this.exchange.fetchOHLCV(asset.binanceSymbol, "4h", undefined, 80)
          ]);

          return [
            asset.symbol,
            {
              symbol: asset.symbol,
              price: ticker.last ?? 0,
              change24h: ticker.percentage ?? 0,
              timestamp: new Date(ticker.timestamp ?? Date.now()).toISOString(),
              candles4h: candles4hRaw.map((candle) => this.toPoint(candle))
            }
          ] as const;
        })
      );

      return new Map(entries);
    } catch (error) {
      this.logger.warn(
        `CCXT Binance signal input fetch failed. ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );

      return new Map();
    }
  }

  async onModuleDestroy() {
    await this.exchange.close();
  }

  private formatPrice(value: number | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "";
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

  private formatChange(value: number | undefined) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "";
    }

    return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
  }

  private toPoint(candle: ccxt.OHLCV): MarketOhlcvPoint {
    return {
      timestamp: Number(candle[0] ?? 0),
      open: Number(candle[1] ?? 0),
      high: Number(candle[2] ?? 0),
      low: Number(candle[3] ?? 0),
      close: Number(candle[4] ?? 0),
      volume: Number(candle[5] ?? 0)
    };
  }
}
