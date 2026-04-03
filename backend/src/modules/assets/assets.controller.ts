import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import { AiAnalysisService } from "../ai/ai-analysis.service";
import { AssetsService } from "./assets.service";

@Controller("assets")
export class AssetsController {
  constructor(
    private readonly assetsService: AssetsService,
    private readonly aiAnalysisService: AiAnalysisService
  ) {}

  @Get(":symbol/detail")
  getDetail(@Param("symbol") symbol: string) {
    return this.assetsService.getPublicDetail(symbol);
  }

  @Get(":symbol/timeline")
  getTimeline(
    @Param("symbol") symbol: string,
    @Query("signal") signal?: string,
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const parsedLimit = typeof limit === "string" ? Number(limit) : undefined;
    const parsedOffset = typeof offset === "string" ? Number(offset) : undefined;
    return this.assetsService.getTimeline(symbol, signal, parsedLimit, parsedOffset);
  }

  @Post(":symbol/ai/recompute")
  recomputeAi(@Param("symbol") symbol: string) {
    return this.aiAnalysisService.recomputeForSymbol(symbol, "manual", true);
  }
}
