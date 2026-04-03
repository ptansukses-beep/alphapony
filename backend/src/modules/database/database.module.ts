import { Global, Module } from "@nestjs/common";
import { AppDataService } from "./app-data.service";
import { PrismaService } from "./prisma.service";
import { SignalChangeService } from "./signal-change.service";

@Global()
@Module({
  providers: [PrismaService, AppDataService, SignalChangeService],
  exports: [PrismaService, AppDataService, SignalChangeService]
})
export class DatabaseModule {}
