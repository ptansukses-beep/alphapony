import { IsOptional, IsString } from "class-validator";

export class UpdateSourceConfigDto {
  @IsOptional()
  @IsString()
  source?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  coverage?: string;
}
