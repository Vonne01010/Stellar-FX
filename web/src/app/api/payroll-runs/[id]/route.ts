import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/payroll-runs/:id — status + full line items of one run
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // In Next.js 15+ (including 16), dynamic route params are async —
    // you must await them before use. This is a common upgrade gotcha
    // if you're used to older Next.js versions where params was a plain object.
    const { id } = await params;

    const run = await prisma.payrollRun.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            employee: {
              select: { id: true, fullName: true, email: true, stellarWallet: true },
            },
            transaction: true,
          },
        },
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: `No payroll run found with id "${id}"` },
        { status: 404 }
      );
    }

    return NextResponse.json(
      JSON.parse(
        JSON.stringify(run, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      )
    );
  } catch (error) {
    console.error("GET /api/payroll-runs/[id] failed:", error);
    return NextResponse.json(
      { error: "Something went wrong fetching the payroll run" },
      { status: 500 }
    );
  }
}