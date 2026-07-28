import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchAnchorInfo } from "@/lib/stellar/anchor-toml";
import { authenticateWithAnchor } from "@/lib/stellar/sep10-auth";
import { getSep24TransactionStatus } from "@/lib/stellar/sep24-withdraw";
import { mapAnchorStatusToItemStatus } from "@/lib/status";

// GET /api/payroll-items/:id/check-status
// Polls the anchor for the latest status of this item's withdraw
// transaction, and updates our own records if it has changed.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const item = await prisma.payrollItem.findUnique({
      where: { id },
      include: { transaction: true },
    });

    if (!item) {
      return NextResponse.json(
        { error: "Payroll item not found" },
        { status: 404 }
      );
    }

    if (!item.transaction?.anchorTxId) {
      return NextResponse.json(
        {
          error:
            "This payroll item has no anchor transaction yet — call initiate-withdraw first",
        },
        { status: 400 }
      );
    }

    // Nothing more to check once we've reached a terminal state
    if (item.status === "DISBURSED" || item.status === "FAILED") {
      return NextResponse.json({
        status: item.status,
        message: "Already in a terminal state, no need to poll further",
      });
    }

    const anchorDomain = process.env.ANCHOR_HOME_DOMAIN?.replace(
      /^https?:\/\//,
      ""
    );
    const platformPublicKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY;
    const platformSecretKey = process.env.PLATFORM_STELLAR_SECRET_KEY;

    if (!anchorDomain || !platformPublicKey || !platformSecretKey) {
      throw new Error("Missing anchor/platform Stellar config");
    }

    const anchorInfo = await fetchAnchorInfo(anchorDomain);
    const jwt = await authenticateWithAnchor(
      anchorInfo.webAuthEndpoint,
      platformPublicKey,
      platformSecretKey
    );

    const anchorTx = await getSep24TransactionStatus(
      anchorInfo.transferServerSep24,
      jwt,
      item.transaction.anchorTxId
    );

    const rawAnchorStatus = String(anchorTx.status ?? "");
    const newItemStatus = mapAnchorStatusToItemStatus(rawAnchorStatus);

    // Nothing changed — don't write to the database or log a no-op
    // history entry just because we polled.
    if (newItemStatus === item.status) {
      return NextResponse.json({
        status: item.status,
        anchorStatus: rawAnchorStatus,
        message: "No status change",
      });
    }

    await prisma.$transaction([
      prisma.transaction.update({
        where: { payrollItemId: item.id },
        data: {
          anchorStatus: rawAnchorStatus,
          // stellar_transaction_id is the on-chain hash the anchor used
          // once it actually pays out — not present on every poll,
          // only once the anchor has moved funds.
          stellarTxHash:
            typeof anchorTx.stellar_transaction_id === "string"
              ? anchorTx.stellar_transaction_id
              : undefined,
        },
      }),
      prisma.payrollItem.update({
        where: { id: item.id },
        data: { status: newItemStatus },
      }),
      prisma.statusHistory.create({
        data: {
          payrollItemId: item.id,
          fromStatus: item.status,
          toStatus: newItemStatus,
          note: `Anchor status: ${rawAnchorStatus}`,
        },
      }),
    ]);

    return NextResponse.json({
      status: newItemStatus,
      anchorStatus: rawAnchorStatus,
      message: "Status updated",
    });
  } catch (error) {
    console.error("Error checking withdraw status:", error);
    return NextResponse.json(
      { error: "Something went wrong checking status" },
      { status: 500 }
    );
  }
}