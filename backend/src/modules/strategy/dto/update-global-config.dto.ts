import { IsObject } from "class-validator";

export class UpdateGlobalConfigDto {
  @IsObject()
  config!: Record<string, string>;
}
