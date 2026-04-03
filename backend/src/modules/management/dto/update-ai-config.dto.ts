import { IsString } from "class-validator";

export class UpdateAiConfigDto {
  @IsString()
  model!: string;

  @IsString()
  provider!: string;

  @IsString()
  baseUrl!: string;

  @IsString()
  apiKey!: string;
}
