import { Body, Controller, Get, Param, Post, Put } from "@nestjs/common";
import { UpdateAiConfigDto } from "./dto/update-ai-config.dto";
import { UpdateLanguagePreferenceDto } from "./dto/update-language-preference.dto";
import { UpdateSourceConfigDto } from "./dto/update-source-config.dto";
import { UpdateTelegramConfigDto } from "./dto/update-telegram-config.dto";
import { ManagementService } from "./management.service";

@Controller("management")
export class ManagementController {
  constructor(private readonly managementService: ManagementService) {}

  @Get("sources")
  getSources() {
    return this.managementService.getSources();
  }

  @Put("sources/:key")
  updateSource(@Param("key") key: string, @Body() body: UpdateSourceConfigDto) {
    return this.managementService.updateSource(key, body);
  }

  @Get("ai-config")
  getAiConfig() {
    return this.managementService.getAiConfig();
  }

  @Get("update-status")
  getUpdateStatus() {
    return this.managementService.getUpdateStatus();
  }

  @Get("telegram-config")
  getTelegramConfig() {
    return this.managementService.getTelegramConfig();
  }

  @Put("telegram-config")
  updateTelegramConfig(@Body() body: UpdateTelegramConfigDto) {
    return this.managementService.updateTelegramConfig(body);
  }

  @Put("preferences/language")
  updateLanguagePreference(@Body() body: UpdateLanguagePreferenceDto) {
    return this.managementService.updateLanguagePreference(body.language);
  }

  @Post("telegram-config/test")
  testTelegramConfig() {
    return this.managementService.testTelegramConfig();
  }

  @Put("ai-config")
  updateAiConfig(@Body() body: UpdateAiConfigDto) {
    return this.managementService.updateAiConfig(body);
  }

  @Post("ai-config/test")
  testAiConfig() {
    return this.managementService.testAiConfig();
  }

  @Post("update-status/check")
  checkForUpdates() {
    return this.managementService.checkForUpdates();
  }
}
