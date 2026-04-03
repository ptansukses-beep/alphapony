import { Module } from "@nestjs/common";
import { AlertsModule } from "../alerts/alerts.module";
import { AssetsModule } from "../assets/assets.module";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { LiveAnalysisPersistenceService } from "./live-analysis-persistence.service";

@Module({
  imports: [AssetsModule, AlertsModule],
  controllers: [DashboardController],
  providers: [DashboardService, LiveAnalysisPersistenceService]
})
export class DashboardModule {}
