import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, setSessionCookie } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const { token, password } = await req.json();

  if (!token || !password) {
    return NextResponse.json(
      { error: "token and password are required." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  const employee = await prisma.employee.findUnique({ where: { inviteToken: token } });
  if (!employee || employee.status !== "INVITED") {
    return NextResponse.json(
      { error: "This invite is invalid or has already been used." },
      { status: 400 }
    );
  }
  if (!employee.inviteTokenExp || employee.inviteTokenExp < new Date()) {
    return NextResponse.json(
      { error: "This invite has expired. Ask your company admin to resend it." },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  const updated = await prisma.employee.update({
    where: { id: employee.id },
    data: {
      passwordHash,
      status: "ACTIVE",
      inviteToken: null,
      inviteTokenExp: null,
    },
  });

  await setSessionCookie({
    employeeId: updated.id,
    companyId: updated.companyId,
    role: updated.role,
  });

  return NextResponse.json({
    employee: {
      id: updated.id,
      email: updated.email,
      fullName: updated.fullName,
      role: updated.role,
      status: updated.status,
      companyId: updated.companyId,
      stellarWallet: updated.stellarWallet,
    },
  });
}
