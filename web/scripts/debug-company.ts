/**
 * Debug script — uses the EXACT same Prisma client instance (`@/lib/db`)
 * that your API routes import, to rule out any mismatch between what
 * Prisma Studio sees and what the running app actually connects to.
 *
 * Run with: npx tsx scripts/debug-company.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

async function main() {
  const companyId = process.env.TEST_COMPANY_ID;
  console.log("Looking up companyId:", JSON.stringify(companyId));

  const company = await prisma.company.findUnique({
    where: { id: companyId },
  });

  console.log("Result:", company);

  const allCompanies = await prisma.company.findMany();
  console.log("\nAll companies in this database:", allCompanies);
}

main()
  .catch((err) => console.error("Debug script error:", err))
  .finally(() => process.exit(0));