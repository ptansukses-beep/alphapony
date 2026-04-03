import { ArrayMinSize, IsArray, IsNumber, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

class RuleWeightDto {
  @IsString()
  type!: string;

  @IsString()
  label!: string;

  @IsNumber()
  @Min(0)
  value!: number;
}

export class UpdateRuleWeightsDto {
  @IsString()
  symbol!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => RuleWeightDto)
  weights!: RuleWeightDto[];
}
