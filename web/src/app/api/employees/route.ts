import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createEmployeeSchema } from "@/lib/validation";

// POST /api/employees — create a new employee
export async function POST(request: NextRequest) {
  try {
    // 1. Parse the incoming JSON body
    const body = await request.json();

    // 2. Validate it against our zod schema
    const parsed = createEmployeeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // 3. Save to the database
    const employee = await prisma.employee.create({
      data: {
        companyId: parsed.data.companyId,
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        stellarWallet: parsed.data.stellarWallet,
      },
    });

    // 4. Return the created record
    return NextResponse.json({ employee }, { status: 201 });
  } catch (error) {
    console.error("Error creating employee:", error);
    return NextResponse.json(
      { error: "Something went wrong creating the employee" },
      { status: 500 }
    );
  }
}

// GET /api/employees — list all employees (optionally filter by companyId)
export async function GET(request: NextRequest) {
  try {
    const companyId = request.nextUrl.searchParams.get("companyId");

    const employees = await prisma.employee.findMany({
      where: companyId ? { companyId } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ employees });
  } catch (error) {
    console.error("Error fetching employees:", error);
    return NextResponse.json(
      { error: "Something went wrong fetching employees" },
      { status: 500 }
    );
  }
}