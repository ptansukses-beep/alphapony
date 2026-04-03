import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { readFileSync } from "fs";
import { join } from "path";
import { AppDataService } from "../database/app-data.service";

type UpdateStatusState = "not_configured" | "up_to_date" | "available" | "failed" | "checking";

type UpdateStatusResult = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  status: UpdateStatusState;
  lastCheckedAt: string | null;
  error: string | null;
};

@Injectable()
export class ManagementService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ManagementService.name);
  private readonly rootDir = join(__dirname, "../../../../");
  private readonly updateCheckIntervalMs = 6 * 60 * 60 * 1000;
  private updateCheckTimer: NodeJS.Timeout | null = null;
  private updateStatus: UpdateStatusResult = {
    currentVersion: this.readCurrentVersion(),
    latestVersion: null,
    updateAvailable: false,
    status: process.env.ALPHAPONY_UPDATE_MANIFEST_URL ? "checking" : "not_configured",
    lastCheckedAt: null,
    error: null
  };

  constructor(private readonly appDataService: AppDataService) {}

  async onModuleInit() {
    if (!process.env.ALPHAPONY_UPDATE_MANIFEST_URL) {
      return;
    }

    void this.checkForUpdates().catch((error) => {
      this.logger.warn(
        `startup update check failed: ${error instanceof Error ? error.message : String(error)}`
      );
    });

    this.updateCheckTimer = setInterval(() => {
      void this.checkForUpdates().catch((error) => {
        this.logger.warn(
          `scheduled update check failed: ${error instanceof Error ? error.message : String(error)}`
        );
      });
    }, this.updateCheckIntervalMs);
  }

  onModuleDestroy() {
    if (this.updateCheckTimer) {
      clearInterval(this.updateCheckTimer);
      this.updateCheckTimer = null;
    }
  }

  private readCurrentVersion() {
    const pkg = JSON.parse(readFileSync(join(this.rootDir, "package.json"), "utf8")) as { version?: string };
    return String(pkg.version ?? "0.0.0");
  }

  private normalizeVersion(version: string | null | undefined) {
    return String(version ?? "").trim().replace(/^v/i, "");
  }

  private compareVersions(left: string, right: string) {
    const leftParts = this.normalizeVersion(left).split(".").map((part) => Number(part) || 0);
    const rightParts = this.normalizeVersion(right).split(".").map((part) => Number(part) || 0);
    const length = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < length; index += 1) {
      const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
      if (diff !== 0) {
        return diff;
      }
    }

    return 0;
  }

  async getSources() {
    return {
      items: await this.appDataService.getSources()
    };
  }

  updateSource(key: string, payload: { source?: string; status?: string; coverage?: string }) {
    return this.appDataService.updateSource(key, payload);
  }

  getAiConfig() {
    return this.appDataService.getAiConfig();
  }

  getTelegramConfig() {
    return this.appDataService.getTelegramConfig();
  }

  updateTelegramConfig(payload: { notificationChannel: string; botToken: string; alertChatId: string }) {
    return this.appDataService.updateTelegramConfig(payload);
  }

  updateLanguagePreference(language: string) {
    return this.appDataService.updateLanguagePreference(language);
  }

  testTelegramConfig() {
    return this.appDataService.testTelegramConfig();
  }

  updateAiConfig(payload: { model: string; provider: string; baseUrl: string; apiKey: string }) {
    return this.appDataService.updateAiConfig(payload);
  }

  testAiConfig() {
    return this.appDataService.testAiConfig();
  }

  getUpdateStatus() {
    return {
      ...this.updateStatus,
      currentVersion: this.readCurrentVersion()
    };
  }

  async checkForUpdates() {
    const currentVersion = this.readCurrentVersion();
    const manifestUrl = process.env.ALPHAPONY_UPDATE_MANIFEST_URL;

    if (!manifestUrl) {
      this.updateStatus = {
        currentVersion,
        latestVersion: null,
        updateAvailable: false,
        status: "not_configured",
        lastCheckedAt: new Date().toISOString(),
        error: "ALPHAPONY_UPDATE_MANIFEST_URL is not configured."
      };
      return this.updateStatus;
    }

    this.updateStatus = {
      ...this.updateStatus,
      currentVersion,
      status: "checking",
      error: null
    };

    try {
      const response = await fetch(manifestUrl, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Manifest request failed with status ${response.status}.`);
      }

      const manifest = (await response.json()) as { version?: string | null };
      const latestVersion = this.normalizeVersion(manifest.version);
      const updateAvailable =
        Boolean(latestVersion) && this.compareVersions(latestVersion, currentVersion) > 0;

      this.updateStatus = {
        currentVersion,
        latestVersion: latestVersion || null,
        updateAvailable,
        status: updateAvailable ? "available" : "up_to_date",
        lastCheckedAt: new Date().toISOString(),
        error: null
      };
    } catch (error) {
      this.updateStatus = {
        currentVersion,
        latestVersion: this.updateStatus.latestVersion,
        updateAvailable: false,
        status: "failed",
        lastCheckedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : String(error)
      };
    }

    return this.updateStatus;
  }
}
