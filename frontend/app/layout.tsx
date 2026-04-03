import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { UpdateNavLink } from "@/components/update-nav-link";
import { getUpdateStatus } from "@/lib/api";
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlphaPony",
  description: "Configurable AI market analysis workspace"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  const locale = getServerLocale();
  const dict = getDictionary(locale);
  let updateAvailable = false;

  try {
    const updateStatus = await getUpdateStatus();
    updateAvailable = updateStatus.updateAvailable === true;
  } catch {
    updateAvailable = false;
  }

  const navItems = [
    { href: "/", label: dict.nav.home },
    { href: "/asset/ALL/timeline", label: dict.nav.timeline },
    { href: "/alerts", label: dict.nav.alerts },
    { href: "/strategy", label: dict.nav.strategy },
    { href: "/sources", label: dict.nav.management }
  ];

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = window.localStorage.getItem("alphapony-theme");
                  var theme = stored || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
                  document.documentElement.setAttribute("data-theme", theme);
                } catch (e) {}
              })();
            `
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var stored = window.localStorage.getItem("${LOCALE_STORAGE_KEY}");
                  var language = stored || "${DEFAULT_LOCALE}";
                  document.documentElement.setAttribute("lang", language);
                  document.documentElement.setAttribute("data-language", language);
                } catch (e) {}
              })();
            `
          }}
        />
      </head>
      <body>
        <div className="app-shell">
          <header className="topbar">
            <div className="topbar-inner">
              <Link href="/" className="brand">
                <div className="brand-mark">AP</div>
                <div className="brand-copy">
                  <span className="brand-name">{dict.meta.brandTitle}</span>
                  <span className="eyebrow">{dict.meta.brandSubtitle}</span>
                </div>
              </Link>
              <nav className="nav-links" aria-label={dict.nav.home}>
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="nav-link">
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="topbar-actions">
                <UpdateNavLink label={dict.management.updateNav} initialVisible={updateAvailable} />
                <ThemeToggle label={dict.common.switchTheme} />
                <LanguageSwitcher
                  switchLabel={dict.language.switchLabel}
                  menuLabel={dict.language.menuLabel}
                />
              </div>
            </div>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
