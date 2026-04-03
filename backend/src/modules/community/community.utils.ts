import {
  COMMUNITY_NEGATIVE_KEYWORDS,
  COMMUNITY_POSITIVE_KEYWORDS,
  COMMUNITY_SYMBOL_ALIASES
} from "./community.constants";
import type { SupportedCommunitySymbol } from "./community.types";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectCommunitySymbols(text: string) {
  const normalized = text.toLowerCase();
  const symbols: SupportedCommunitySymbol[] = [];

  for (const [symbol, aliases] of Object.entries(COMMUNITY_SYMBOL_ALIASES) as Array<
    [SupportedCommunitySymbol, string[]]
  >) {
    const matched = aliases.some((alias) => {
      const pattern =
        alias.length <= 4
          ? new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, "i")
          : new RegExp(escapeRegExp(alias), "i");
      return pattern.test(normalized);
    });

    if (matched) {
      symbols.push(symbol);
    }
  }

  return symbols;
}

export function scoreCommunitySentiment(text: string) {
  const normalized = text.toLowerCase();
  const positive = COMMUNITY_POSITIVE_KEYWORDS.filter((keyword) => normalized.includes(keyword)).length;
  const negative = COMMUNITY_NEGATIVE_KEYWORDS.filter((keyword) => normalized.includes(keyword)).length;

  return {
    positive,
    negative,
    net: positive - negative
  };
}

export function communityScoreToBiasLevel(score: number) {
  if (score <= -75) return "super_bearish" as const;
  if (score <= -45) return "strong_bearish" as const;
  if (score <= -15) return "weak_bearish" as const;
  if (score < 15) return "watch" as const;
  if (score < 45) return "weak_bullish" as const;
  if (score < 75) return "strong_bullish" as const;
  return "super_bullish" as const;
}

export function communityScoreToDirection(score: number) {
  if (score >= 18) return "bullish" as const;
  if (score <= -18) return "bearish" as const;
  return "watch" as const;
}
