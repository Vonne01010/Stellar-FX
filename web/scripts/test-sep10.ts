/**
 * Standalone test script — NOT part of the app's routes.
 * Run manually with: npx tsx scripts/test-sep10.ts
 * (or: node --loader ts-node/esm scripts/test-sep10.ts, depending on your setup)
 *
 * Purpose: verify authenticateWithAnchor() actually completes a real
 * SEP-10 handshake against a live testnet anchor, before we build
 * anything else on top of it.
 */
import "dotenv/config";
import { fetchAnchorInfo } from "../src/lib/stellar/anchor-toml";
import { authenticateWithAnchor } from "../src/lib/stellar/sep10-auth";

async function main() {
  const domain = process.env.ANCHOR_HOME_DOMAIN?.replace(/^https?:\/\//, "");
  const publicKey = process.env.PLATFORM_STELLAR_PUBLIC_KEY;
  const secretKey = process.env.PLATFORM_STELLAR_SECRET_KEY;

  if (!domain || !publicKey || !secretKey) {
    throw new Error(
      "Missing ANCHOR_HOME_DOMAIN, PLATFORM_STELLAR_PUBLIC_KEY, or PLATFORM_STELLAR_SECRET_KEY in .env"
    );
  }

  console.log(`Fetching anchor info for: ${domain}`);
  const anchorInfo = await fetchAnchorInfo(domain);
  console.log("Anchor info:", anchorInfo);

  console.log("\nStarting SEP-10 authentication...");
  const token = await authenticateWithAnchor(
    anchorInfo.webAuthEndpoint,
    publicKey,
    secretKey
  );

  console.log("\n✅ SEP-10 authentication succeeded!");
  console.log("JWT (first 20 chars):", token.slice(0, 20) + "...");
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err);
  process.exit(1);
});