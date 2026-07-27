import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentEmployee, generateInviteToken } from "@/lib/auth";

const INVITE_EXPIRY_DAYS = 7;

export async function POST(req: NextRequest) {
  const currentEmployee = await getCurrentEmployee();
  if (!currentEmployee) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (currentEmployee.role !== "ADMIN") {
    return NextResponse.json(
      { error: "You do not have permission to do this." },
      { status: 403 }
    );
  }

  const { email, fullName } = await req.json();
  if (!email || !fullName) {
    return NextResponse.json(
      { error: "email and fullName are required." },
      { status: 400 }
    );
  }

  const existing = await prisma.employee.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists." },
      { status: 409 }
    );
  }

  const inviteToken = generateInviteToken();
  const inviteTokenExp = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const employee = await prisma.employee.create({
    data: {
      email,
      fullName,
      companyId: currentEmployee.companyId,
      role: "EMPLOYEE",
      status: "INVITED",
      inviteToken,
      inviteTokenExp,
      // passwordHash and stellarWallet stay null until steps 2 and 3
    },
  });

  // TODO: hand `inviteToken` to your notifications module to email the
  // employee a link like `${APP_URL}/onboard/${inviteToken}`
  return NextResponse.json(
    { employeeId: employee.id, inviteToken },
    { status: 201 }
  );
}
