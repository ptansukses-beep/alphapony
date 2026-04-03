import { IsString, MinLength } from "class-validator";

export class UpdatePromptDto {
  @IsString()
  @MinLength(1)
  promptText!: string;
}
