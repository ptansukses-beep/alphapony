CREATE TABLE "SystemTelegramConfig" (
    "id" TEXT NOT NULL,
    "botTokenEncrypted" TEXT NOT NULL,
    "alertChatId" TEXT NOT NULL,
    "connectionStatus" TEXT NOT NULL,
    "lastCheckedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemTelegramConfig_pkey" PRIMARY KEY ("id")
);
