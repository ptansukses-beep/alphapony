"use client";

import Link from "next/link";
import { formatAlertSummary } from "@/lib/alerts";
import type { AlertsResponse } from "@/lib/api-types";
import type { Dictionary } from "@/lib/i18n";
import type { LocaleCode } from "@/lib/i18n/config";

type HomeAlertsStripProps = {
  items: AlertsResponse["items"];
  latestLabel: string;
  importantLabel: string;
  viewAllLabel: string;
  locale: LocaleCode;
  dict: Dictionary;
};

export function HomeAlertsStrip({
  dict,
  items,
  importantLabel,
  latestLabel,
  locale,
  viewAllLabel
}: HomeAlertsStripProps) {
  const visibleItems = items.slice(0, 3);
  const hasFresh = visibleItems.some((item) => item.status.toLowerCase() === "new");

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <div
      className={`home-alerts-strip-compact ${hasFresh ? "home-alerts-strip-compact-fresh" : ""}`}
    >
      <span className={`home-alerts-flag ${hasFresh ? "home-alerts-flag-fresh" : ""}`}>
        {hasFresh ? importantLabel : latestLabel}
      </span>
      <div className="home-alerts-lines">
        {visibleItems.map((item) => (
          <Link key={item.id} href="/alerts" className="home-alerts-line">
            <span className={`home-alerts-message ${hasFresh ? "home-alerts-message-fresh" : ""}`}>
              {formatAlertSummary(item, locale, dict).main}
            </span>
          </Link>
        ))}
      </div>
      <Link href="/alerts" className="home-alerts-more">
        {viewAllLabel}
      </Link>
    </div>
  );
}
