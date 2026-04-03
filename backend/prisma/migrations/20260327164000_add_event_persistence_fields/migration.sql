ALTER TABLE "Event"
ADD COLUMN "fingerprint" TEXT,
ADD COLUMN "score" INTEGER,
ADD COLUMN "payloadJson" JSONB;

CREATE UNIQUE INDEX "Event_fingerprint_key" ON "Event"("fingerprint");
