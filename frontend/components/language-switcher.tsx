"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLanguagePreference } from "@/lib/api";
import {
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  localeOptions,
  DEFAULT_LOCALE,
  normalizeLocale,
  type LocaleCode
} from "@/lib/i18n/config";

type LanguageSwitcherProps = {
  switchLabel: string;
  menuLabel: string;
};

export function LanguageSwitcher({ switchLabel, menuLabel }: LanguageSwitcherProps) {
  const router = useRouter();
  const [language, setLanguage] = useState<LocaleCode>(() => {
    if (typeof document !== "undefined") {
      const current = document.documentElement.getAttribute("data-language");
      if (current) {
        return normalizeLocale(current);
      }
    }

    return normalizeLocale();
  });
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const currentLanguageLabel =
    localeOptions.find((item) => item.code === language)?.label ??
    localeOptions.find((item) => item.code === DEFAULT_LOCALE)?.label ??
    language;

  useEffect(() => {
    const stored = normalizeLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
    setLanguage(stored);
    document.documentElement.setAttribute("lang", stored);
    document.documentElement.setAttribute("data-language", stored);
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  function handleSelect(code: LocaleCode) {
    if (code === language) {
      setOpen(false);
      return;
    }

    setLanguage(code);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, code);
    document.cookie = `${LOCALE_COOKIE_KEY}=${code}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.setAttribute("lang", code);
    document.documentElement.setAttribute("data-language", code);
    setOpen(false);
    startTransition(async () => {
      try {
        await updateLanguagePreference(code);
      } catch (error) {
        console.warn("Failed to sync language preference", error);
      }

      router.refresh();
    });
  }

  return (
    <div className="lang-wrap" ref={wrapRef}>
      <button
        type="button"
        className="lang-pill"
        disabled={isPending}
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={switchLabel}
      >
        <span className="lang-label" aria-hidden="true" suppressHydrationWarning>
          {currentLanguageLabel}
        </span>
      </button>
      {open ? (
        <div className="lang-menu" role="menu" aria-label={menuLabel}>
          {localeOptions.map((item) => (
            <div
              key={item.code}
              role="menuitem"
              className={item.code === language ? "lang-option lang-option-active" : "lang-option"}
              onClick={() => handleSelect(item.code)}
            >
              {item.label}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
