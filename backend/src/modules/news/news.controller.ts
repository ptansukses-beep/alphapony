import { Controller, Get, Query } from "@nestjs/common";
import { ListNewsQueryDto } from "./dto/list-news-query.dto";
import { NewsService } from "./news.service";

@Controller("news")
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  listNews(@Query() query: ListNewsQueryDto) {
    return this.newsService.listNews(query);
  }
}
