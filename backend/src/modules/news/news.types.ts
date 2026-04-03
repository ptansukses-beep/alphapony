import { SupportedNewsSymbol } from "./news.constants";

export type NewsCategory =
  | "macro_politics"
  | "macro_finance"
  | "crypto_industry"
  | "asset_specific";

export type NewsProviderType = "gdelt" | "rss" | "guardian";

export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceType: NewsProviderType;
  publishedAt: string;
  summary?: string;
  category: NewsCategory;
  categoryLabel: string;
  symbols: SupportedNewsSymbol[];
  language?: string;
};

export type ListNewsOptions = {
  symbol?: SupportedNewsSymbol;
  category?: NewsCategory;
  limit: number;
};

export type NewsResponse = {
  updatedAt: string;
  query: {
    symbol?: SupportedNewsSymbol;
    category?: NewsCategory;
    limit: number;
  };
  items: NewsItem[];
  sources: {
    gdelt: number;
    rss: number;
    guardian: number;
  };
};

export type NewsSignalEvaluation = {
  symbol: SupportedNewsSymbol;
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
