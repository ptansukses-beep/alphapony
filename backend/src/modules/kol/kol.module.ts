import { Global, Module } from "@nestjs/common";
import { KolNitterProvider } from "./kol-nitter.provider";
import { KolRuleService } from "./kol-rule.service";
import { KolService } from "./kol.service";

@Global()
@Module({
  providers: [KolNitterProvider, KolRuleService, KolService],
  exports: [KolService]
})
export class KolModule {}
