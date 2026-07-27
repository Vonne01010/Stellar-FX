import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/payroll-history?employeeId=xxx  → one employee's full history
// GET /api/payroll-history?companyId=xxx   → all payroll items across a company
// (Exactly one of the two must be provided.)
export async function GET(request: NextRequest) {
  try {
    const employeeId = request.nextUrl.searchParams.get("employeeId");
    const companyId = request.nextUrl.searchParams.get("companyId");

    if (!employeeId && !companyId) {
      return NextResponse.json(
        { error: "Provide either employeeId or companyId as a query parameter" },
        { status: 400 }
      );
    }

    if (employeeId && companyId) {
      return NextResponse.json(
        { error: "Provide only one of employeeId or companyId, not both" },
        { status: 400 }
      );
    }

    // Build the where-clause differently depending on which mode we're in.
    // For companyId, we filter through the related employee, since
    // PayrollItem doesn't store companyId directly (it belongs to an
    // Employee, who belongs to a Company).
    const where = employeeId
      ? { employeeId }
      : { employee: { companyId: companyId! } };

    const items = await prisma.payrollItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { id: true, fullName: true, email: true } },
        payrollRun: { select: { id: true, status: true, createdAt: true } },
        transaction: true,
        statusHistory: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json(
      JSON.parse(
        JSON.stringify(items, (_key, value) =>
          typeof value === "bigint" ? value.toString() : value
        )
      )
    );
  } catch (error) {
    console.error("GET /api/payroll-history failed:", error);
    return NextResponse.json(
      { error: "Something went wrong fetching payroll history" },
      { status: 500 }
    );
  }
}