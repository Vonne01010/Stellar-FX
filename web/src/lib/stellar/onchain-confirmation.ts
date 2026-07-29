import { Horizon } from "@stellar/stellar-sdk";

/**
 * On-chain confirmation via Horizon: rather than needing a webhook or
 * direct integration with the Soroban contract's internals, we simply
 * ask Horizon (Stellar's public API) "has a payment of this asset and
 * amount arrived at this wallet recently?" This decouples our backend
 * from the contract's implementation details — we only care about the
 * end result landing on-chain, which Horizon can always tell us.
 */

export class OnChainConfirmationError extends Error {}

export interface ConfirmedPayment {
  transactionHash: string;
  amount: string; // as returned by Horizon, human-readable decimal string
  from: string;
  createdAt: string;
}

const horizonServer = new Horizon.Server(
  process.env.STELLAR_NETWORK === "PUBLIC"
    ? "https://horizon.stellar.org"
    : "https://horizon-testnet.stellar.org"
);

/**
 * Checks an employee's wallet for a recent incoming payment matching
 * the expected asset and amount. Returns the matching payment if found,
 * or null if nothing matching has arrived yet (not an error — this is
 * the normal "still waiting" case while polling).
 *
 * @param destinationWallet - the employee's Stellar public key
 * @param expectedAssetCode - e.g. "PHP" or whatever the anchor pays out in on-chain,
 *   if the payout itself is a Stellar payment rather than an off-chain bank transfer
 * @param expectedAmount - human-readable decimal string, e.g. "500.0000000"
 * @param sinceLedgerCloseTime - only consider payments after this ISO timestamp,
 *   to avoid matching an old unrelated payment with the same amount
 */
export async function findConfirmedPayment(
  destinationWallet: string,
  expectedAssetCode: string,
  expectedAmount: string,
  sinceLedgerCloseTime: Date
): Promise<ConfirmedPayment | null> {
  try {
    const payments = await horizonServer
      .payments()
      .forAccount(destinationWallet)
      .order("desc")
      .limit(20)
      .call();

    for (const record of payments.records) {
      // We only care about actual payment operations, not other
      // operation types (trustline changes, etc.) that can appear
      // in the same account's operation history.
      if (record.type !== "payment" && record.type !== "path_payment_strict_receive") {
        continue;
      }

      const createdAt = new Date(record.created_at);
      if (createdAt < sinceLedgerCloseTime) {
        continue;
      }

      const assetMatches =
        "asset_code" in record && record.asset_code === expectedAssetCode;
      const amountMatches =
        "amount" in record && record.amount === expectedAmount;

      if (assetMatches && amountMatches) {
        return {
          transactionHash: record.transaction_hash,
          amount: record.amount,
          from: "from" in record ? record.from : "",
          createdAt: record.created_at,
        };
      }
    }

    return null;
  } catch (err) {
    throw new OnChainConfirmationError(
      `Could not fetch payments for wallet "${destinationWallet}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}