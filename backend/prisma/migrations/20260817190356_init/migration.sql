-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "LampStatus" AS ENUM ('UNKNOWN', 'ONLINE', 'OFFLINE', 'ERROR');

-- CreateEnum
CREATE TYPE "CommandType" AS ENUM ('TURN_ON', 'TURN_OFF', 'SET_BRIGHTNESS');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "password" VARCHAR(60) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lamps" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "devEui" VARCHAR(16) NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "currentBrightness" INTEGER,
    "status" "LampStatus" NOT NULL DEFAULT 'UNKNOWN',
    "lastSeen" TIMESTAMP(3),
    "ownerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lamps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uplinks" (
    "id" SERIAL NOT NULL,
    "lampId" INTEGER NOT NULL,
    "payload" VARCHAR(512) NOT NULL,
    "port" INTEGER,
    "rssi" INTEGER,
    "snr" DOUBLE PRECISION,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uplinks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "downlinks" (
    "id" SERIAL NOT NULL,
    "lampId" INTEGER NOT NULL,
    "command" "CommandType" NOT NULL,
    "argument" INTEGER,
    "payload" VARCHAR(512) NOT NULL,
    "port" INTEGER NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "error" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "downlinks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "lamps_devEui_key" ON "lamps"("devEui");

-- CreateIndex
CREATE INDEX "lamps_ownerId_idx" ON "lamps"("ownerId");

-- CreateIndex
CREATE INDEX "lamps_status_idx" ON "lamps"("status");

-- CreateIndex
CREATE INDEX "uplinks_lampId_receivedAt_idx" ON "uplinks"("lampId", "receivedAt" DESC);

-- CreateIndex
CREATE INDEX "downlinks_lampId_createdAt_idx" ON "downlinks"("lampId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "downlinks_isSent_cancelled_idx" ON "downlinks"("isSent", "cancelled");

-- AddForeignKey
ALTER TABLE "lamps" ADD CONSTRAINT "lamps_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "uplinks" ADD CONSTRAINT "uplinks_lampId_fkey" FOREIGN KEY ("lampId") REFERENCES "lamps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downlinks" ADD CONSTRAINT "downlinks_lampId_fkey" FOREIGN KEY ("lampId") REFERENCES "lamps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "downlinks" ADD CONSTRAINT "downlinks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
