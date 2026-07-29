import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  findConfirmedPayment,
  OnChainConfirmationError,
} from "@/lib/stellar/onchain-confirmation";

// POST /api/payroll-items/:id/confirm-onchain
// Checks Horizon for the on-chain payout landing in the employee's
// wallet, and marks the item DISBURSED if found. Meant to be called
// after an item reaches DISBURSING (anchor has finished converting,
// payout is in progress), either manually or via a scheduled job
// alongside poll-pending.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
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

    if (item.status !== "DISBURSING") {
      return NextResponse.json(
        {
          error: `Payroll item is in status "${item.status}", expected "DISBURSING" — nothing to confirm yet`,
        },
        { status: 409 }
      );
    }

    // Only consider payments from when this item's Transaction record
    // was created (i.e. when the withdraw was initiated) onward, so we
    // don't accidentally match an unrelated older payment of the same
    // amount to the same wallet.
    const sinceDate = item.transaction?.createdAt ?? item.createdAt;

    const payoutAssetCode = process.env.ANCHOR_PAYOUT_ASSET_CODE ?? "PHP";

    // amountPhp is set once the anchor reports the converted amount;
    // until then we don't know the exact PHP figure to match against.
    if (!item.amountPhp) {
      return NextResponse.json(
        {
          error:
            "amountPhp not yet known for this item — anchor hasn't reported the converted amount",
        },
        { status: 400 }
      );
    }

    // amountPhp stored as BigInt smallest-unit; Horizon returns amounts
    // as human-readable decimal strings, so convert for comparison.
    const humanAmountPhp = (Number(item.amountPhp) / 10_000_000).toFixed(7);

    const confirmed = await findConfirmedPayment(
      item.employee.stellarWallet,
      payoutAssetCode,
      humanAmountPhp,
      sinceDate
    );

    if (!confirmed) {
      return NextResponse.json({
        confirmed: false,
        message: "No matching on-chain payment found yet — try again shortly",
      });
    }

    await prisma.$transaction([
      prisma.transaction.update({
        where: { payrollItemId: item.id },
        data: { stellarTxHash: confirmed.transactionHash },
      }),
      prisma.payrollItem.update({
        where: { id: item.id },
        data: { status: "DISBURSED" },
      }),
      prisma.statusHistory.create({
        data: {
          payrollItemId: item.id,
          fromStatus: "DISBURSING",
          toStatus: "DISBURSED",
          note: `Confirmed on-chain: tx ${confirmed.transactionHash}`,
        },
      }),
    ]);

    return NextResponse.json({
      confirmed: true,
      transactionHash: confirmed.transactionHash,
    });
  } catch (error) {
    console.error("Error confirming on-chain disbursement:", error);

    if (error instanceof OnChainConfirmationError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }

    return NextResponse.json(
      { error: "Something went wrong confirming on-chain disbursement" },
      { status: 500 }
    );
  }
}