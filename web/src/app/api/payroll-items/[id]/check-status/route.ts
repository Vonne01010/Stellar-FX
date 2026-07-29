import { NextRequest, NextResponse } from "next/server";
import { checkAndUpdatePayrollItemStatus } from "@/lib/stellar/status-checker";

// GET /api/payroll-items/:id/check-status
// Polls the anchor for the latest status of this item's withdraw
// transaction, and updates our own records if it has changed.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const result = await checkAndUpdatePayrollItemStatus(id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error checking withdraw status:", error);
    const message =
      error instanceof Error ? error.message : "Something went wrong checking status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}