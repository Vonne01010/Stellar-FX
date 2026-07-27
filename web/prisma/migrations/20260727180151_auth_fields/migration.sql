/*
  Warnings:

  - A unique constraint covering the columns `[inviteToken]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('INVITED', 'ACTIVE', 'WALLET_CONNECTED');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "inviteTokenExp" TIMESTAMP(3),
ADD COLUMN     "passwordHash" TEXT,
ADD COLUMN     "status" "EmployeeStatus" NOT NULL DEFAULT 'INVITED',
ALTER COLUMN "stellarWallet" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_inviteToken_key" ON "Employee"("inviteToken");
