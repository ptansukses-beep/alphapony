export type ExchangeTickerSnapshot = {
  symbol: string;
  price: string;
  priceChange: string;
  timestamp: string;
};

export type AggregatedMarketSnapshot = {
  symbol: string;
  name?: string;
  image?: string;
  marketCapRank?: number;
  price?: string;
  priceChange?: string;
  timestamp: string;
};

export type UnifiedMarketSnapshot = {
  symbol: string;
  price: string;
  priceChange: string;
  timestamp: string;
  source: "exchange" | "aggregated" | "database";
  name?: string;
  image?: string;
  marketCapRank?: number;
};

export type MarketOhlcvPoint = {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketSignalInput = {
  symbol: string;
  price: number;
  change24h: number;
  timestamp: string;
  candles4h: MarketOhlcvPoint[];
};

export type MarketSignalEvaluation = {
  symbol: string;
  score: number;
  direction: "bullish" | "bearish" | "watch";
  biasLevel:
    | "super_bearish"
    | "strong_bearish"
    | "weak_bearish"
    | "watch"
    | "weak_bullish"
    | "strong_bullish"
    | "super_bullish";
  confidence: string;
  drivers: string[];
  metrics: Array<{ name: string; value: string }>;
  highlights: Array<{ title: string; href: string; publishedAt?: string; score?: number }>;
};
