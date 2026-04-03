import { DEFAULT_LOCALE, type LocaleCode, normalizeLocale } from "./config";
import { enUSMessages } from "./messages/en-US";
import { zhCNMessages } from "./messages/zh-CN";

export const dictionaries = {
  "zh-CN": zhCNMessages,
  "en-US": enUSMessages
} as const;

export type Dictionary = (typeof dictionaries)[typeof DEFAULT_LOCALE];

export function getDictionary(locale?: string | null): Dictionary {
  const normalizedLocale: LocaleCode = normalizeLocale(locale);
  return dictionaries[normalizedLocale];
}
