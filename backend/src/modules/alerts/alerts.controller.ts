import { Controller, Get, Query } from "@nestjs/common";
import { AlertsService } from "./alerts.service";

@Controller("alerts")
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get()
  list(
    @Query("limit") limit?: string,
    @Query("offset") offset?: string
  ) {
    const parsedLimit = typeof limit === "string" ? Number(limit) : undefined;
    const parsedOffset = typeof offset === "string" ? Number(offset) : undefined;

    return this.alertsService.list(parsedLimit, parsedOffset);
  }
}
