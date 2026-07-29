import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentEmployee } from "@/lib/auth";

const STELLAR_PUBLIC_KEY = /^G[A-Z0-9]{55}$/;

export async function PATCH(req: NextRequest) {
  const currentEmployee = await getCurrentEmployee();
  if (!currentEmployee) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { stellarWallet } = await req.json();
  if (!stellarWallet || !STELLAR_PUBLIC_KEY.test(stellarWallet)) {
    return NextResponse.json(
      { error: "That does not look like a valid Stellar public key." },
      { status: 400 }
    );
  }

  const updated = await prisma.employee.update({
    where: { id: currentEmployee.id },
    data: { stellarWallet, status: "WALLET_CONNECTED" },
  });

  return NextResponse.json({
    stellarWallet: updated.stellarWallet,
    status: updated.status,
  });
}
