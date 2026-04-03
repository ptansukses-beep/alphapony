import { Injectable } from "@nestjs/common";
import { AppDataService } from "../database/app-data.service";
import { baseTemplates } from "../../data/seed-data";

@Injectable()
export class StrategyService {
  constructor(private readonly appDataService: AppDataService) {}

  getConfig(symbol: string) {
    return this.appDataService.getStrategyConfig(symbol.toUpperCase());
  }

  updateRuleTemplate(symbol: string, template: "aggressive" | "conservative" | "default" | "custom") {
    return this.appDataService.updateRuleTemplate(
      symbol.toUpperCase(),
      template,
      baseTemplates[template].weights as never
    );
  }

  updateRuleWeights(
    symbol: string,
    weights: Array<{ type: string; label: string; value: number }>
  ) {
    return this.appDataService.updateRuleWeights(symbol.toUpperCase(), weights);
  }

  updatePrompt(promptText: string) {
    return this.appDataService.updatePrompt(promptText);
  }

  updateGlobalConfig(
    section: "sources" | "onchainWhaleRules" | "preferences" | "alertRules",
    config: Record<string, string>
  ) {
    return this.appDataService.updateGlobalConfig(section, config);
  }
}
