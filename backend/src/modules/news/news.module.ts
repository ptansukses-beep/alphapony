import { Global, Module } from "@nestjs/common";
import { NewsController } from "./news.controller";
import { NewsGdeltProvider } from "./news-gdelt.provider";
import { NewsGuardianProvider } from "./news-guardian.provider";
import { NewsRuleService } from "./news-rule.service";
import { NewsRssProvider } from "./news-rss.provider";
import { NewsService } from "./news.service";

@Global()
@Module({
  controllers: [NewsController],
  providers: [NewsService, NewsGdeltProvider, NewsGuardianProvider, NewsRssProvider, NewsRuleService],
  exports: [NewsService]
})
export class NewsModule {}
