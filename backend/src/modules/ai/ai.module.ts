import { Global, Module } from "@nestjs/common";
import { AiAnalysisService } from "./ai-analysis.service";

@Global()
@Module({
  providers: [AiAnalysisService],
  exports: [AiAnalysisService]
})
export class AiModule {}
