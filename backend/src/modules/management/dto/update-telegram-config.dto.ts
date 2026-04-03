import { IsString } from "class-validator";

export class UpdateTelegramConfigDto {
  @IsString()
  notificationChannel!: string;

  @IsString()
  botToken!: string;

  @IsString()
  alertChatId!: string;
}
