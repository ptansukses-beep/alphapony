"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getAlerts } from "@/lib/api";
import { formatAlertSeverity, formatAlertSummary, formatAlertType, inferAlertSeverity } from "@/lib/alerts";
import type { AlertsResponse } from "@/lib/api-types";
import type { Dictionary } from "@/lib/i18n";
import type { LocaleCode } from "@/lib/i18n/config";
import { formatAbsoluteTime, formatDisplayPrice } from "@/lib/format";

type AlertsFeedProps = {
  initialItems: AlertsResponse["items"];
  initialTotal: number;
  locale: LocaleCode;
  dict: Dictionary;
};

function alertStatusLabel(status: string, dict: Dictionary) {
  switch (status.toLowerCase()) {
    case "sent":
      return dict.common.statusSent;
    case "new":
      return dict.common.statusPending;
    default:
      return status;
  }
}

export function AlertsFeed({ initialItems, initialTotal, locale, dict }: AlertsFeedProps) {
  const [items, setItems] = useState(initialItems);
  const [total, setTotal] = useState(initialTotal);
  const [isPending, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const hasMore = items.length < total;

  function loadMore() {
    if (isPending || !hasMore) {
      return;
    }

    startTransition(async () => {
      const next = await getAlerts(50, items.length);
      setItems((current) => [...current, ...next.items]);
      setTotal(next.total);
    });
  }

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "320px 0px" }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [hasMore, isPending, items.length, total]);

  if (items.length === 0) {
    return (
      <div className="detail-card">
        <p className="section-subtitle">{dict.alerts.noRecords}</p>
      </div>
    );
  }

  return (
    <>
      <div className="timeline">
        {items.map((alert) => {
          const parsed = formatAlertSummary(alert, locale, dict);
          const severityEmoji = formatAlertSeverity(alert, locale);

          return (
            <div key={alert.id} className="timeline-item alert-item">
              <div className="timeline-time">{formatAbsoluteTime(alert.timestamp, locale)}</div>
              <div>
                <div className="alert-meta">
                  {severityEmoji ? <span className={`alert-severity alert-severity-${inferAlertSeverity(alert)}`}>{severityEmoji}</span> : null}
                  <span>{alert.asset} · {formatAlertType(alert, locale)} · <span className="alert-status">{alertStatusLabel(alert.status, dict)}</span></span>
                </div>
                <h3 className="timeline-title">{parsed.main}</h3>
                {parsed.price || parsed.priceChange ? (
                  <div className="alert-context-row">
                    {formatDisplayPrice(parsed.price) ? <span className="meta-pill">{dict.common.price} {formatDisplayPrice(parsed.price)}</span> : null}
                    {parsed.priceChange ? <span className="meta-pill">24H {parsed.priceChange}</span> : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      {hasMore ? <div ref={sentinelRef} className="timeline-loading-hint">{isPending ? dict.common.loading : dict.common.loadMoreHint}</div> : null}
    </>
  );
}
