import { Global, Module } from "@nestjs/common";
import { OnchainDataService } from "./onchain-data.service";
import { OnchainEvmProvider } from "./onchain-evm.provider";
import { OnchainRuleService } from "./onchain-rule.service";
import { OnchainSolanaProvider } from "./onchain-solana.provider";
import { OnchainXrpProvider } from "./onchain-xrp.provider";

@Global()
@Module({
  providers: [
    OnchainEvmProvider,
    OnchainSolanaProvider,
    OnchainXrpProvider,
    OnchainRuleService,
    OnchainDataService
  ],
  exports: [OnchainDataService]
})
export class OnchainModule {}
