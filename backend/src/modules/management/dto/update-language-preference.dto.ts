import { IsString } from "class-validator";

export class UpdateLanguagePreferenceDto {
  @IsString()
  language!: string;
}
