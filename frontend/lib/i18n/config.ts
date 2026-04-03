export const SUPPORTED_LOCALES = ["zh-CN", "en-US"] as const;

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: LocaleCode = "zh-CN";

export const LOCALE_STORAGE_KEY = "alphapony-language";
export const LOCALE_COOKIE_KEY = "alphapony-language";

export const localeOptions: Array<{ code: LocaleCode; label: string }> = [
  { code: "zh-CN", label: "中文" },
  { code: "en-US", label: "English" }
];

export function isSupportedLocale(value: string): value is LocaleCode {
  return SUPPORTED_LOCALES.includes(value as LocaleCode);
}

export function normalizeLocale(value?: string | null): LocaleCode {
  if (value && isSupportedLocale(value)) {
    return value;
  }

  return DEFAULT_LOCALE;
}
