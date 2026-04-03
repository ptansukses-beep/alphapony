import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { delimiter, resolve } from "node:path";
import { AiModule } from "./modules/ai/ai.module";
import { AlertsModule } from "./modules/alerts/alerts.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { CommunityModule } from "./modules/community/community.module";
import { DatabaseModule } from "./modules/database/database.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { KolModule } from "./modules/kol/kol.module";
import { ManagementModule } from "./modules/management/management.module";
import { MarketModule } from "./modules/market/market.module";
import { NewsModule } from "./modules/news/news.module";
import { OnchainModule } from "./modules/onchain/onchain.module";
import { StrategyModule } from "./modules/strategy/strategy.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        ...(process.env.ALPHAPONY_ENV_PATH?.split(delimiter).filter(Boolean) ?? []),
        resolve(process.cwd(), ".env.local"),
        resolve(process.cwd(), ".env")
      ]
    }),
    AiModule,
    DatabaseModule,
    MarketModule,
    NewsModule,
    CommunityModule,
    KolModule,
    OnchainModule,
    DashboardModule,
    AssetsModule,
    StrategyModule,
    ManagementModule,
    AlertsModule
  ]
})
export class AppModule {}
