import { Transform, Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import { NEWS_MAX_LIMIT, SUPPORTED_NEWS_SYMBOLS } from "../news.constants";
import { NewsCategory } from "../news.types";

const NEWS_CATEGORIES: NewsCategory[] = [
  "macro_politics",
  "macro_finance",
  "crypto_industry",
  "asset_specific"
];

export class ListNewsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.toUpperCase() : value))
  @IsIn(SUPPORTED_NEWS_SYMBOLS)
  symbol?: (typeof SUPPORTED_NEWS_SYMBOLS)[number];

  @IsOptional()
  @IsIn(NEWS_CATEGORIES)
  category?: NewsCategory;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(NEWS_MAX_LIMIT)
  limit?: number;
}
