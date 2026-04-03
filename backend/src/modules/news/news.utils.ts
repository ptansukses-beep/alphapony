import {
  CRYPTO_KEYWORDS,
  MACRO_FINANCE_KEYWORDS,
  MACRO_POLITICS_KEYWORDS,
  NEWS_CATEGORY_LABELS,
  NEWS_SYMBOL_ALIASES,
  SupportedNewsSymbol
} from "./news.constants";
import { NewsCategory } from "./news.types";

export function normalizeText(value: string | undefined | null) {
  return (value ?? "").toLowerCase().trim();
}

export function detectSymbols(text: string) {
  const normalized = normalizeText(text);
  const matches: SupportedNewsSymbol[] = [];

  (Object.entries(NEWS_SYMBOL_ALIASES) as Array<[SupportedNewsSymbol, string[]]>).forEach(
    ([symbol, aliases]) => {
      if (aliases.some((alias) => normalized.includes(alias))) {
        matches.push(symbol);
      }
    }
  );

  return matches;
}

export function classifyNewsCategory(text: string, fallback?: NewsCategory) {
  const normalized = normalizeText(text);
  const symbols = detectSymbols(normalized);

  if (symbols.length > 0) {
    return "asset_specific";
  }

  if (MACRO_POLITICS_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "macro_politics";
  }

  if (MACRO_FINANCE_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "macro_finance";
  }

  if (CRYPTO_KEYWORDS.some((keyword) => normalized.includes(keyword))) {
    return "crypto_industry";
  }

  return fallback ?? "crypto_industry";
}

export function categoryLabel(category: NewsCategory) {
  return NEWS_CATEGORY_LABELS[category];
}

export function stripHtml(value: string | undefined | null) {
  return (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((key) =>
      url.searchParams.delete(key)
    );
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function uniqueNewsKey(title: string, url: string) {
  return `${normalizeText(title)}::${canonicalUrl(url)}`;
}
