/*
  Warnings:

  - A unique constraint covering the columns `[payrollRunId,employeeId]` on the table `PayrollItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE "StatusHistory" (
    "id" TEXT NOT NULL,
    "payrollItemId" TEXT NOT NULL,
    "fromStatus" "ItemStatus",
    "toStatus" "ItemStatus" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StatusHistory_payrollItemId_idx" ON "StatusHistory"("payrollItemId");

-- CreateIndex
CREATE INDEX "Employee_companyId_idx" ON "Employee"("companyId");

-- CreateIndex
CREATE INDEX "PayrollItem_employeeId_idx" ON "PayrollItem"("employeeId");

-- CreateIndex
CREATE INDEX "PayrollItem_status_idx" ON "PayrollItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollItem_payrollRunId_employeeId_key" ON "PayrollItem"("payrollRunId", "employeeId");

-- CreateIndex
CREATE INDEX "PayrollRun_companyId_idx" ON "PayrollRun"("companyId");

-- CreateIndex
CREATE INDEX "PayrollRun_status_idx" ON "PayrollRun"("status");

-- CreateIndex
CREATE INDEX "Transaction_anchorTxId_idx" ON "Transaction"("anchorTxId");

-- CreateIndex
CREATE INDEX "Transaction_stellarTxHash_idx" ON "Transaction"("stellarTxHash");

-- AddForeignKey
ALTER TABLE "StatusHistory" ADD CONSTRAINT "StatusHistory_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "PayrollItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
