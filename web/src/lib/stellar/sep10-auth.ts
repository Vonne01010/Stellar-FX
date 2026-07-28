import { Keypair, Transaction, Networks } from "@stellar/stellar-sdk";

/**
 * SEP-10 authentication: proves control of a Stellar account to an anchor
 * in exchange for a JWT token, which is then required to call SEP-24
 * (deposit/withdraw) endpoints. Without this, the anchor has no way to
 * know which Stellar account it's dealing with, or that we actually
 * control it (rather than just claiming to).
 */

export class Sep10AuthError extends Error {}

interface ChallengeResponse {
  transaction: string; // XDR-encoded challenge transaction from the anchor
  network_passphrase?: string;
}

interface TokenResponse {
  token: string; // the JWT we'll attach to SEP-24 requests
}

/**
 * Runs the full SEP-10 flow and returns a JWT.
 *
 * @param webAuthEndpoint - from AnchorInfo.webAuthEndpoint (fetchAnchorInfo)
 * @param account - our platform's Stellar public key (the "client account")
 * @param signerSecret - the matching secret key, used to sign the challenge.
 *   NEVER log this value or include it in any response sent to the client.
 */
export async function authenticateWithAnchor(
  webAuthEndpoint: string,
  account: string,
  signerSecret: string
): Promise<string> {
  const challengeUrl = new URL(webAuthEndpoint);
  challengeUrl.searchParams.set("account", account);

  const challengeRes = await fetch(challengeUrl.toString());
  if (!challengeRes.ok) {
    throw new Sep10AuthError(
      `Anchor rejected challenge request: HTTP ${challengeRes.status}`
    );
  }

  const challenge: ChallengeResponse = await challengeRes.json();

  const networkPassphrase = challenge.network_passphrase ?? Networks.TESTNET;

  let transaction: Transaction;
  try {
    transaction = new Transaction(challenge.transaction, networkPassphrase);
  } catch (err) {
    throw new Sep10AuthError(
      `Could not parse challenge transaction from anchor: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const signerKeypair = Keypair.fromSecret(signerSecret);
  transaction.sign(signerKeypair);

  const tokenRes = await fetch(webAuthEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transaction: transaction.toXDR(),
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    throw new Sep10AuthError(
      `Anchor rejected signed challenge: HTTP ${tokenRes.status} — ${body}`
    );
  }

  const { token }: TokenResponse = await tokenRes.json();

  if (!token) {
    throw new Sep10AuthError("Anchor did not return a JWT token");
  }

  return token;
}