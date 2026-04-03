import { Injectable } from "@nestjs/common";
import { AppDataService } from "../database/app-data.service";

@Injectable()
export class AlertsService {
  constructor(private readonly appDataService: AppDataService) {}

  async list(limit?: number, offset?: number) {
    const parsedLimit = typeof limit === "number" && Number.isFinite(limit) ? limit : 50;
    const parsedOffset = typeof offset === "number" && Number.isFinite(offset) ? offset : 0;

    return this.appDataService.listAlerts(parsedLimit, parsedOffset);
  }
}
