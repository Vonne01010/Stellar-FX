import { prisma } from "@/lib/db";
import { fetchAnchorInfo } from "@/lib/stellar/anchor-toml";
import { authenticateWithAnchor } from "@/lib/stellar/sep10-auth";
import { getSep24TransactionStatus } from "@/lib/stellar/sep24-withdraw";
import { mapAnchorStatusToItemStatus } from "@/lib/status";

export interface StatusCheckResult {
  itemId: string;
  previousStatus: string;
  newStatus: string;
  anchorStatus: string;
  changed: boolean;
}

/**
 * Checks one payroll item's anchor transaction status and updates our
 * records if it changed. Shared by both the single-item check-status
 * route and the poll-pending bulk route, so the actual logic only
 * lives in one place.
 */
export async function checkAndUpdatePayrollItemStatus(
  itemId: string
): Promise<StatusCheckResult> {
  const item = await prisma.payrollItem.findUnique({
    where: { id: itemId },
    include: { transaction: true },
  });

  if (!item) {
    throw new Error(`Payroll item ${itemId} not found`);
  }

  if (!item.transaction?.anchorTxId) {
    throw new Error(
      `Payroll item ${itemId} has no anchor transaction yet`
    );
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

  if (newItemStatus === item.status) {
    return {
      itemId,
      previousStatus: item.status,
      newStatus: item.status,
      anchorStatus: rawAnchorStatus,
      changed: false,
    };
  }

  await prisma.$transaction([
    prisma.transaction.update({
      where: { payrollItemId: item.id },
      data: {
        anchorStatus: rawAnchorStatus,
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

  return {
    itemId,
    previousStatus: item.status,
    newStatus: newItemStatus,
    anchorStatus: rawAnchorStatus,
    changed: true,
  };
}