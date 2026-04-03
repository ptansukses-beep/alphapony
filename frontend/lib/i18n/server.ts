import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE_KEY, type LocaleCode, normalizeLocale } from "./config";

export function getServerLocale(): LocaleCode {
  const cookieStore = cookies();
  return normalizeLocale(cookieStore.get(LOCALE_COOKIE_KEY)?.value ?? DEFAULT_LOCALE);
}
