import Link from "next/link";
import { ASSET_OPTIONS } from "@/lib/constants";

type AssetStripProps = {
  activeSymbol: string;
  compact?: boolean;
};

export function AssetStrip({ activeSymbol, compact = false }: AssetStripProps) {
  return (
    <div className={compact ? "asset-strip-detail" : "asset-strip"}>
      {ASSET_OPTIONS.map((asset) => {
        const active = asset.symbol === activeSymbol;
        const className = compact
          ? active
            ? "asset-chip-tab-active"
            : "asset-chip-tab"
          : active
            ? "asset-chip-active"
            : "asset-chip";

        return (
          <Link
            key={asset.symbol}
            href={asset.symbol === "BTC" ? "/" : `/asset/${asset.symbol}`}
            className={className}
          >
            {compact ? (
              <span className="detail-asset-anchor">
                <strong>{asset.symbol}</strong>
              </span>
            ) : (
              <>
                <span className="asset-symbol">{asset.symbol}</span>
                <span className="asset-price">
                  {asset.name}
                </span>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}
