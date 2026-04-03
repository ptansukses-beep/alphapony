import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { AiAnalysisService } from "../ai/ai-analysis.service";
import { AssetsService } from "../assets/assets.service";
import { AppDataService } from "../database/app-data.service";

@Injectable()
export class DashboardSnapshotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DashboardSnapshotService.name);
  private readonly persistIntervalMs = 10 * 60 * 1000;
  private readonly initialDelayMs = 20_000;
  private persistTimer: NodeJS.Timeout | null = null;
  private initialTimer: NodeJS.Timeout | null = null;
  private inFlight: Promise<void> | null = null;
  private hasPersistedAtLeastOnce = false;

  constructor(
    private readonly appDataService: AppDataService,
    private readonly assetsService: AssetsService,
    private readonly aiAnalysisService: AiAnalysisService
  ) {}

  onModuleInit() {
    this.initialTimer = setTimeout(() => {
      void this.persistCurrentSnapshots();
    }, this.initialDelayMs);

    this.persistTimer = setInterval(() => {
      void this.persistCurrentSnapshots();
    }, this.persistIntervalMs);
  }

  onModuleDestroy() {
    if (this.initialTimer) {
      clearTimeout(this.initialTimer);
      this.initialTimer = null;
    }

    if (this.persistTimer) {
      clearInterval(this.persistTimer);
      this.persistTimer = null;
    }
  }

  private async persistCurrentSnapshots() {
    if (this.inFlight) {
      return this.inFlight;
    }

    this.inFlight = (async () => {
      try {
        const assets = await this.appDataService.listTrackedAssets();
        const details = await Promise.all(
          assets.map((asset) => this.assetsService.getDetail(asset.symbol))
        );

        const persistedCount = await this.appDataService.persistLiveAssetDetails(
          details,
          this.hasPersistedAtLeastOnce ? undefined : 0
        );
        await this.aiAnalysisService.recomputeForSymbols(
          assets.map((asset) => asset.symbol),
          "periodic"
        );
        this.hasPersistedAtLeastOnce = true;
        this.logger.log(`persisted ${persistedCount} live analysis snapshots`);
      } catch (error) {
        this.logger.warn(
          error instanceof Error ? error.message : String(error)
        );
      }
    })();

    try {
      await this.inFlight;
    } finally {
      this.inFlight = null;
    }
  }
}
