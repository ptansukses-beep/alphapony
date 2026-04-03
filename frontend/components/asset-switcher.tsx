"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ASSET_OPTIONS } from "@/lib/constants";
import type { Dictionary } from "@/lib/i18n";

type AssetSwitcherProps = {
  activeSymbol: string;
  destination?: "detail" | "timeline";
  includeAll?: boolean;
  signalType?: string;
  dict: Dictionary;
};

export function AssetSwitcher({
  activeSymbol,
  destination = "detail",
  includeAll = false,
  signalType,
  dict
}: AssetSwitcherProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const options = includeAll
    ? [{ symbol: "ALL", name: dict.asset.allAssets }, ...ASSET_OPTIONS]
    : ASSET_OPTIONS;

  function buildHref(symbol: string) {
    if (destination === "timeline") {
      const query = signalType ? `?signal=${encodeURIComponent(signalType)}` : "";
      return `/asset/${symbol}/timeline${query}`;
    }

    return `/asset/${symbol}`;
  }

  return (
    <div className="detail-switcher-wrap" ref={wrapRef}>
      <button
        type="button"
        className="detail-symbol-button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <h1 className="detail-symbol">{activeSymbol}</h1>
        <span className="detail-symbol-caret" aria-hidden="true">
          ▼
        </span>
      </button>

      {open ? (
        <div className="detail-switcher-menu" role="menu" aria-label={dict.asset.switchAsset}>
          {options.map((asset) => {
            const active = asset.symbol === activeSymbol;
            return (
              <Link
                key={asset.symbol}
                href={buildHref(asset.symbol)}
                className={active ? "detail-switcher-item-active" : "detail-switcher-item"}
                role="menuitem"
              >
                <strong>{asset.symbol}</strong>
                <span>{asset.symbol === "ALL" ? dict.asset.allAssets : asset.name}</span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
