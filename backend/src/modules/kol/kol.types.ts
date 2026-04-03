export const SUPPORTED_KOL_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE"] as const;

export type SupportedKolSymbol = (typeof SUPPORTED_KOL_SYMBOLS)[number];
export type KolAuthorTier = "core" | "watchlist";

export type KolPost = {
  id: string;
  author: string;
  title: string;
  body: string;
  publishedAt: string;
  url: string;
  matchedSymbols: SupportedKolSymbol[];
  authorWeight: number;
  authorTier: KolAuthorTier;
};

export type KolSignalEvaluation = {
  symbol: SupportedKolSymbol;
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
