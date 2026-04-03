import { Body, Controller, Get, Param, Put, Query } from "@nestjs/common";
import { UpdateGlobalConfigDto } from "./dto/update-global-config.dto";
import { UpdatePromptDto } from "./dto/update-prompt.dto";
import { UpdateRuleWeightsDto } from "./dto/update-rule-weights.dto";
import { UpdateRuleTemplateDto } from "./dto/update-rule-template.dto";
import { StrategyService } from "./strategy.service";

@Controller("strategy")
export class StrategyController {
  constructor(private readonly strategyService: StrategyService) {}

  @Get("config")
  getConfig(@Query("symbol") symbol = "BTC") {
    return this.strategyService.getConfig(symbol);
  }

  @Put("rule-template")
  updateRuleTemplate(@Body() body: UpdateRuleTemplateDto) {
    return this.strategyService.updateRuleTemplate(body.symbol, body.template);
  }

  @Put("rule-weights")
  updateRuleWeights(@Body() body: UpdateRuleWeightsDto) {
    return this.strategyService.updateRuleWeights(body.symbol, body.weights);
  }

  @Put("prompt")
  updatePrompt(@Body() body: UpdatePromptDto) {
    return this.strategyService.updatePrompt(body.promptText);
  }

  @Put("global/:section")
  updateGlobalConfig(
    @Param("section")
    section: "sources" | "onchainWhaleRules" | "preferences" | "alertRules",
    @Body()
    body: UpdateGlobalConfigDto
  ) {
    return this.strategyService.updateGlobalConfig(section, body.config);
  }
}
