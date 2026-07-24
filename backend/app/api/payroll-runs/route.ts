import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createPayrollRunSchema } from "@/lib/validation";
import { ZodError } from "zod";

// POST /api/payroll-runs — create a new payroll batch with line items
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const data = createPayrollRunSchema.parse(body);

    const company = await prisma.company.findUnique({
      where: { id: data.companyId },
    });
    if (!company) {
      return NextResponse.json(
        { error: `No company found with id "${data.companyId}"` },
        { status: 404 }
      );
    }

    // Confirm every employeeId in the request actually belongs to
    // THIS company. Without this check, someone could accidentally
    // (or maliciously) include an employee from a different company
    // in this payroll run.
    const employeeIds = data.items.map((item) => item.employeeId);
    const employees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, companyId: data.companyId },
      select: { id: true },
    });

    const foundIds = new Set(employees.map((e) => e.id));
    const missingIds = employeeIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      return NextResponse.json(
        {
          error:
            "Some employeeIds were not found under this company",
          missingIds,
        },
        { status: 400 }
      );
    }

    // Convert validated string amounts to BigInt, and sum them for
    // the run's totalUsdc snapshot.
    const itemsWithBigInt = data.items.map((item) => ({
      employeeId: item.employeeId,
      amountUsdc: BigInt(item.amountUsdc),
    }));
    const totalUsdc = itemsWithBigInt.reduce(
      (sum, item) => sum + item.amountUsdc,
      BigInt(0)
    );

    // prisma.$transaction ensures ALL of this succeeds together or
    // NONE of it does. Without this, a crash halfway through creating
    // 50 payroll items would leave you with a run that has, say, 23
    // items instead of 50 — a corrupted, partial payroll batch that's
    // very hard to safely recover from.
    const payrollRun = await prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.create({
        data: {
          companyId: data.companyId,
          totalUsdc,
          status: "PENDING",
        },
      });

      // createMany is one round-trip to the database instead of N,
      // but it doesn't return the created rows, so we create the
      // initial StatusHistory entries separately per item below.
      await tx.payrollItem.createMany({
        data: itemsWithBigInt.map((item) => ({
          payrollRunId: run.id,
          employeeId: item.employeeId,
          amountUsdc: item.amountUsdc,
          status: "PENDING",
        })),
      });

      // Fetch the items back so we can log their initial status
      // in the audit trail, and so we can return full data to the caller.
      const createdItems = await tx.payrollItem.findMany({
        where: { payrollRunId: run.id },
      });

      await tx.statusHistory.createMany({
        data: createdItems.map((item) => ({
          payrollItemId: item.id,
          fromStatus: null,
          toStatus: "PENDING",
          note: "Payroll item created",
        })),
      });

      return { ...run, items: createdItems };
    });

    return NextResponse.json(
      // BigInt doesn't serialize to JSON by default — convert to string
      // for the response, same reason we accepted it as a string on the way in.
      JSON.parse(
        JSON.stringify(payrollRun, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      ),
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", issues: error.issues },
        { status: 400 }
      );
    }

    console.error("POST /api/payroll-runs failed:", error);
    return NextResponse.json(
      { error: "Something went wrong creating the payroll run" },
      { status: 500 }
    );
  }
}

// GET /api/payroll-runs?companyId=xxx — list payroll runs for a company
export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId");

    if (!companyId) {
      return NextResponse.json(
        { error: "companyId query parameter is required" },
        { status: 400 }
      );
    }

    const runs = await prisma.payrollRun.findMany({
      where: { companyId },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });

    return NextResponse.json(
      JSON.parse(
        JSON.stringify(runs, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      )
    );
  } catch (error) {
    console.error("GET /api/payroll-runs failed:", error);
    return NextResponse.json(
      { error: "Something went wrong fetching payroll runs" },
      { status: 500 }
    );
  }
}