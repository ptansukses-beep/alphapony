import { Global, Module } from "@nestjs/common";
import { CommunityRedditProvider } from "./community-reddit.provider";
import { CommunityRuleService } from "./community-rule.service";
import { CommunityService } from "./community.service";
import { CommunityTelegramProvider } from "./community-telegram.provider";

@Global()
@Module({
  providers: [CommunityRedditProvider, CommunityTelegramProvider, CommunityRuleService, CommunityService],
  exports: [CommunityService]
})
export class CommunityModule {}
