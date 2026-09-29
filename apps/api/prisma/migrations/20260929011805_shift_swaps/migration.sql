-- CreateEnum
CREATE TYPE "SwapStatus" AS ENUM ('PENDING_COWORKER', 'PENDING_MANAGER', 'APPROVED', 'DECLINED', 'DENIED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ShiftSwap" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "targetEmployeeId" TEXT NOT NULL,
    "targetShiftId" TEXT,
    "message" TEXT,
    "status" "SwapStatus" NOT NULL DEFAULT 'PENDING_COWORKER',
    "respondedAt" TIMESTAMP(3),
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftSwap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShiftSwap_status_idx" ON "ShiftSwap"("status");

-- CreateIndex
CREATE INDEX "ShiftSwap_requesterId_idx" ON "ShiftSwap"("requesterId");

-- CreateIndex
CREATE INDEX "ShiftSwap_targetEmployeeId_idx" ON "ShiftSwap"("targetEmployeeId");

-- CreateIndex
CREATE INDEX "ShiftSwap_shiftId_idx" ON "ShiftSwap"("shiftId");

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_targetEmployeeId_fkey" FOREIGN KEY ("targetEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_targetShiftId_fkey" FOREIGN KEY ("targetShiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSwap" ADD CONSTRAINT "ShiftSwap_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
