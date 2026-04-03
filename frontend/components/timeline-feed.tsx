"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { getAssetTimeline } from "@/lib/api";
import type { Direction, TimelineResponse } from "@/lib/api-types";
import type { Dictionary } from "@/lib/i18n";
import type { LocaleCode } from "@/lib/i18n/config";
import {
  biasLevelClassName,
  biasLevelFromScore,
  biasLevelLabel,
  formatAbsoluteTime,
  formatSignalHighlightTitle,
  signalLabel
} from "@/lib/format";

type TimelineFeedProps = {
  symbol: string;
  signalType?: string;
  initialItems: TimelineResponse["items"];
  initialTotal: number;
  locale: LocaleCode;
  dict: Dictionary;
};

function isValidExternalHref(href?: string) {
  if (!href) {
    return false;
  }

  const trimmed = href.trim();
  return Boolean(trimmed) && trimmed !== "#";
}

function formatSignedScore(score?: number) {
  if (typeof score !== "number") {
    return null;
  }

  return score > 0 ? `+${score}` : String(score);
}

function displayDirection(score: number | undefined, fallback: Direction) {
  return biasLevelFromScore(score, fallback);
}

export function TimelineFeed({
  symbol,
  signalType,
  initialItems,
  initialTotal,
  locale,
  dict
}: TimelineFeedProps) {
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
      const next = await getAssetTimeline(symbol, signalType, 50, items.length);
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
  }, [hasMore, items.length, isPending, total]);

  return (
    <>
      {items.length > 0 ? (
        <>
          <div className="timeline">
            {items.map((item) => {
              const resolvedBiasLevel = displayDirection(item.score, item.direction);

              return (
                <div key={`${item.assetSymbol}-${item.time}-${item.title}`} className="timeline-item">
                  <div className="timeline-time">{formatAbsoluteTime(item.time, locale)}</div>
                  <div>
                    <div className="event-meta">
                      {item.assetSymbol} · {signalLabel(item.typeKey ?? item.type, locale, item.type)} ·{" "}
                      <span className={biasLevelClassName(resolvedBiasLevel)}>
                        {biasLevelLabel(resolvedBiasLevel, locale)}
                      </span>
                      {typeof item.score === "number" ? (
                        <>
                          {" "}·{" "}
                          <span className={biasLevelClassName(resolvedBiasLevel)}>
                            {formatSignedScore(item.score)}
                          </span>
                        </>
                      ) : null}
                    </div>
                    {isValidExternalHref(item.href) ? (
                      <h3 className="timeline-title">
                        <a href={item.href} target="_blank" rel="noreferrer">
                          {formatSignalHighlightTitle(item, locale)}
                        </a>
                      </h3>
                    ) : (
                      <h3 className="timeline-title">{formatSignalHighlightTitle(item, locale)}</h3>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {hasMore ? <div ref={sentinelRef} className="timeline-loading-hint">{isPending ? dict.common.loading : dict.common.loadMoreHint}</div> : null}
        </>
      ) : (
        <div className="detail-card">
          <p className="section-subtitle">{dict.common.noData}</p>
        </div>
      )}
    </>
  );
}
