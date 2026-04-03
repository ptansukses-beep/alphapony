"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type AiAvailabilityRefreshProps = {
  enabled: boolean;
  intervalMs?: number;
};

export function PageAutoRefresh({
  enabled,
  intervalMs = 15_000
}: AiAvailabilityRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const refresh = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const timer = window.setInterval(refresh, intervalMs);
    return () => window.clearInterval(timer);
  }, [enabled, intervalMs, router]);

  return null;
}

export function AiAvailabilityRefresh(props: AiAvailabilityRefreshProps) {
  return <PageAutoRefresh {...props} />;
}
