/**
 * SEP-24 interactive withdraw: initiates a USDC -> fiat (PHP) withdrawal
 * with the anchor. The anchor returns a URL for a hosted interactive
 * form (bank details, KYC if required) — we don't build that UI ourselves,
 * we just kick off the transaction and hand the person that URL.
 */

export class Sep24WithdrawError extends Error {}

export interface InteractiveWithdrawResult {
  type: string; // typically "interactive_customer_info_needed"
  url: string; // the hosted URL to open (in an iframe or new tab)
  id: string; // the anchor's transaction id — SAVE this, it's how we track status later
}

interface WithdrawRequestParams {
  transferServerSep24: string; // from AnchorInfo.transferServerSep24
  jwt: string; // from authenticateWithAnchor()
  assetCode: string; // e.g. "USDC"
  account: string; // the Stellar account withdrawing (platform or employee wallet)
  amount?: string; // optional: pre-fill amount, anchor may still ask to confirm
}

/**
 * Starts an interactive SEP-24 withdraw transaction.
 */
export async function startInteractiveWithdraw(
  params: WithdrawRequestParams
): Promise<InteractiveWithdrawResult> {
  const { transferServerSep24, jwt, assetCode, account, amount } = params;

  const url = `${transferServerSep24}/transactions/withdraw/interactive`;

  const body = new URLSearchParams({
    asset_code: assetCode,
    account,
  });
  if (amount) {
    body.set("amount", amount);
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${jwt}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Sep24WithdrawError(
      `Anchor rejected withdraw request: HTTP ${res.status} — ${errorBody}`
    );
  }

  const data = await res.json();

  if (!data.url || !data.id) {
    throw new Sep24WithdrawError(
      "Anchor response missing required 'url' or 'id' field"
    );
  }

  return {
    type: data.type,
    url: data.url,
    id: data.id,
  };
}

/**
 * Fetches the current status of a SEP-24 transaction by its anchor id.
 * Used for polling until the withdrawal completes or fails.
 */
export async function getSep24TransactionStatus(
  transferServerSep24: string,
  jwt: string,
  transactionId: string
): Promise<Record<string, unknown>> {
  const url = new URL(`${transferServerSep24}/transaction`);
  url.searchParams.set("id", transactionId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${jwt}` },
  });

  if (!res.ok) {
    throw new Sep24WithdrawError(
      `Could not fetch transaction status: HTTP ${res.status}`
    );
  }

  const data = await res.json();
  return data.transaction;
}