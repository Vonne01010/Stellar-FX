import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json(
      { error: "email and password are required." },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee || !employee.passwordHash) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }
  if (employee.status === "INVITED") {
    return NextResponse.json(
      { error: "This account hasn't been activated yet. Check your invite email." },
      { status: 403 }
    );
  }

  const valid = await verifyPassword(password, employee.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  await setSessionCookie({
    employeeId: employee.id,
    companyId: employee.companyId,
    role: employee.role,
  });

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
