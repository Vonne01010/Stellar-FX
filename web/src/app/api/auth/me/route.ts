import { NextResponse } from "next/server";
import { getCurrentEmployee } from "@/lib/auth";

export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  return NextResponse.json({
    employee: {
      id: employee.id,
      email: employee.email,
      fullName: employee.fullName,
      role: employee.role,
      status: employee.status,
      companyId: employee.companyId,
      stellarWallet: employee.stellarWallet,
    },
  });
}
