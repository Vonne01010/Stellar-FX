import { StellarTomlResolver } from "@stellar/stellar-sdk";

/**
 * The fields we actually care about from an anchor's stellar.toml.
 * Anchors publish many more fields than this (SIGNING_KEY, ACCOUNTS,
 * CURRENCIES, etc.) — we only type the ones our code touches, and treat
 * the rest as unknown rather than pretending we've modeled the whole spec.
 */
export interface AnchorInfo {
  webAuthEndpoint: string; // SEP-10: where we authenticate before calling SEP-24
  transferServerSep24: string; // SEP-24: where deposit/withdraw calls go
  signingKey: string; // the anchor's own Stellar public key, used to verify
  //   that the SEP-10 challenge really came from this anchor and not
  //   an attacker impersonating it
}

export class AnchorTomlError extends Error {}

/**
 * Fetch and parse an anchor's stellar.toml, returning only the fields
 * our SEP-10/SEP-24 flow needs.
 *
 * @param domain - the anchor's domain, WITHOUT protocol or path,
 *   e.g. "testanchor.stellar.org" (not "https://testanchor.stellar.org/...")
 */
export async function fetchAnchorInfo(domain: string): Promise<AnchorInfo> {
  let toml: Record<string, unknown>;

  try {
    // StellarTomlResolver.resolve fetches
    // https://{domain}/.well-known/stellar.toml and parses it into a
    // plain object for us — it also enforces the file isn't absurdly
    // large, which raw fetch + a naive parser wouldn't protect against.
    toml = await StellarTomlResolver.resolve(domain);
  } catch (err) {
    throw new AnchorTomlError(
      `Could not fetch stellar.toml from "${domain}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  const webAuthEndpoint = toml.WEB_AUTH_ENDPOINT;
  const transferServerSep24 = toml.TRANSFER_SERVER_SEP0024;
  const signingKey = toml.SIGNING_KEY;

  // Fail loudly and specifically here — if any of these are missing,
  // it usually means either the domain isn't a real SEP-24 anchor at
  // all, or it only supports a different SEP (e.g. SEP-6 instead of
  // SEP-24). Better to know that now than get a confusing 404 later
  // when we try to call an endpoint that doesn't exist.
  if (typeof webAuthEndpoint !== "string" || !webAuthEndpoint) {
    throw new AnchorTomlError(
      `"${domain}" does not publish WEB_AUTH_ENDPOINT — it may not support SEP-10 authentication`
    );
  }
  if (typeof transferServerSep24 !== "string" || !transferServerSep24) {
    throw new AnchorTomlError(
      `"${domain}" does not publish TRANSFER_SERVER_SEP0024 — it may not support SEP-24`
    );
  }
  if (typeof signingKey !== "string" || !signingKey) {
    throw new AnchorTomlError(
      `"${domain}" does not publish a SIGNING_KEY — cannot verify SEP-10 challenges from it`
    );
  }

  return { webAuthEndpoint, transferServerSep24, signingKey };
}