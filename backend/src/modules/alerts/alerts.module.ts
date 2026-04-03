import { Module } from "@nestjs/common";
import { AlertingService } from "./alerting.service";
import { AlertsController } from "./alerts.controller";
import { AlertsService } from "./alerts.service";

@Module({
  controllers: [AlertsController],
  providers: [AlertsService, AlertingService],
  exports: [AlertingService]
})
export class AlertsModule {}
