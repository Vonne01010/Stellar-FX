import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// POST /api/payroll-items/:id/retry
// Resets a FAILED item back to PENDING so initiate-withdraw can be
// called on it again — e.g. after a transient anchor error, or after
// a KYC/info issue was resolved manually with the employee.
//
// Deliberately does NOT touch the existing Transaction row's anchorTxId —
// a fresh initiate-withdraw call will start a brand new anchor
// transaction (anchors don't generally support "resuming" a failed one),
// and the old transaction id stays in StatusHistory for audit purposes.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const item = await prisma.payrollItem.findUnique({ where: { id } });

    if (!item) {
      return NextResponse.json(
        { error: "Payroll item not found" },
        { status: 404 }
      );
    }

    if (item.status !== "FAILED") {
      return NextResponse.json(
        {
          error: `Payroll item is in status "${item.status}", can only retry from "FAILED"`,
        },
        { status: 409 }
      );
    }

    await prisma.$transaction([
      prisma.payrollItem.update({
        where: { id: item.id },
        data: { status: "PENDING" },
      }),
      prisma.statusHistory.create({
        data: {
          payrollItemId: item.id,
          fromStatus: "FAILED",
          toStatus: "PENDING",
          note: "Manually reset for retry",
        },
      }),
    ]);

    return NextResponse.json({
      message: "Item reset to PENDING — call initiate-withdraw again to retry",
    });
  } catch (error) {
    console.error("Error retrying payroll item:", error);
    return NextResponse.json(
      { error: "Something went wrong retrying the payroll item" },
      { status: 500 }
    );
  }
}