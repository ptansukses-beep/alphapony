import { Global, Module } from "@nestjs/common";
import { MarketAggregatorProvider } from "./market-aggregator.provider";
import { MarketDataService } from "./market-data.service";
import { MarketExchangeProvider } from "./market-exchange.provider";
import { MarketRuleService } from "./market-rule.service";

@Global()
@Module({
  providers: [MarketExchangeProvider, MarketAggregatorProvider, MarketRuleService, MarketDataService],
  exports: [MarketDataService]
})
export class MarketModule {}
