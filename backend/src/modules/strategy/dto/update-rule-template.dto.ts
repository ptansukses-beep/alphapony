import { IsIn, IsString } from "class-validator";

export class UpdateRuleTemplateDto {
  @IsString()
  symbol!: string;

  @IsIn(["aggressive", "conservative", "default", "custom"])
  template!: "aggressive" | "conservative" | "default" | "custom";
}
