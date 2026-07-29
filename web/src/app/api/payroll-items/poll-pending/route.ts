import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkAndUpdatePayrollItemStatus } from "@/lib/stellar/status-checker";

// GET /api/payroll-items/poll-pending
// Intended to be called by a scheduled job (e.g. every 1-2 minutes) —
// checks every payroll item that's still in-flight with the anchor
// (CONVERTING or DISBURSING) and syncs its status. Terminal states
// (DISBURSED, FAILED, PENDING-not-yet-started) are skipped entirely.
export async function GET() {
  const inFlightItems = await prisma.payrollItem.findMany({
    where: { status: { in: ["CONVERTING", "DISBURSING"] } },
    select: { id: true },
  });

  const results = [];

  // Sequential, not Promise.all — each check makes its own SEP-10 auth
  // call to the anchor, and hammering the anchor with dozens of
  // simultaneous auth requests risks rate-limiting. Slower but safer
  // for a batch job that isn't latency-sensitive.
  for (const { id } of inFlightItems) {
    try {
      const result = await checkAndUpdatePayrollItemStatus(id);
      results.push(result);
    } catch (error) {
      results.push({
        itemId: id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({
    checked: results.length,
    changed: results.filter((r) => "changed" in r && r.changed).length,
    results,
  });
}