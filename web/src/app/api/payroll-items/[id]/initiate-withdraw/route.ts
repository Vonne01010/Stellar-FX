import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAnchorInfo, AnchorTomlError } from "@/lib/stellar/anchor-toml";
import { authenticateWithAnchor, Sep10AuthError } from "@/lib/stellar/sep10-auth";
import {
  startInteractiveWithdraw,
  Sep24WithdrawError,
} from "@/lib/stellar/sep24-withdraw";

// POST /api/payroll-items/:id/initiate-withdraw
// Kicks off the SEP-24 withdraw flow for one employee's payroll line item.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    // 1. Load the payroll item + employee wallet
    const item = await prisma.payrollItem.findUnique({
      where: { id },
      include: { employee: true, transaction: true },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Payroll item not found" },
        { status: 404 }
      );
    }

    // Guard against re-running this on an item that's already past PENDING —
    // prevents accidentally starting a second anchor transaction for the
    // same payment if this route gets called twice (e.g. a network retry).
    if (item.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Payroll item is already in status "${item.status}" — cannot re-initiate withdraw`,
        },
        { status: 409 }
      );
    }

    // 2. Resolve anchor info from env config
    const anchorDomain = process.env.ANCHOR_HOME_DOMAIN?.replace(
      /^https?:\/\//,
      ""
    );
    const assetCode = process.env.USDC_ASSET_CODE;
    const platformPublicKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY;
    const platformSecretKey = process.env.PLATFORM_STELLAR_SECRET_KEY;

    if (
      !anchorDomain ||
      !assetCode ||
      !platformPublicKey ||
      !platformSecretKey
    ) {
      throw new Error(
        "Missing anchor/platform Stellar config in environment variables"
      );
    }

    const anchorInfo = await fetchAnchorInfo(anchorDomain);

    // 3. SEP-10 authenticate
    const jwt = await authenticateWithAnchor(
      anchorInfo.webAuthEndpoint,
      platformPublicKey,
      platformSecretKey
    );

    // 4. Start the interactive withdraw
    // amountUsdc is stored as BigInt in smallest units — the anchor's
    // interactive form typically wants a human-readable decimal string,
    // so we convert here rather than pushing that logic into the SEP-24
    // helper (which shouldn't need to know our internal unit convention).
    const humanAmount = (Number(item.amountUsdc) / 10_000_000).toString();

    const withdrawResult = await startInteractiveWithdraw({
      transferServerSep24: anchorInfo.transferServerSep24,
      jwt,
      assetCode,
      account: item.employee.stellarWallet,
      amount: humanAmount,
    });

    // 5-7. Persist transaction record, update status, log history —
    // all in one transaction so we never end up with a saved anchor
    // reference but a stale item status, or vice versa.
    await prisma.$transaction([
      prisma.transaction.upsert({
        where: { payrollItemId: item.id },
        create: {
          payrollItemId: item.id,
          anchorTxId: withdrawResult.id,
          anchorStatus: "incomplete",
        },
        update: {
          anchorTxId: withdrawResult.id,
          anchorStatus: "incomplete",
        },
      }),
      prisma.payrollItem.update({
        where: { id: item.id },
        data: { status: "CONVERTING" },
      }),
      prisma.statusHistory.create({
        data: {
          payrollItemId: item.id,
          fromStatus: item.status,
          toStatus: "CONVERTING",
          note: `SEP-24 withdraw initiated, anchor tx id: ${withdrawResult.id}`,
        },
      }),
    ]);

    // 8. Return the interactive URL for the frontend to open
    return NextResponse.json({
      interactiveUrl: withdrawResult.url,
      anchorTransactionId: withdrawResult.id,
    });
  } catch (error) {
    console.error("Error initiating withdraw:", error);

    if (
      error instanceof AnchorTomlError ||
      error instanceof Sep10AuthError ||
      error instanceof Sep24WithdrawError
    ) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json(
      { error: "Something went wrong initiating the withdraw" },
      { status: 500 }
    );
  }
}