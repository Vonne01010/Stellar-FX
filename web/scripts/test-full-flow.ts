/**
 * Standalone end-to-end test — NOT part of the app's routes.
 * Run with: npx tsx scripts/test-full-flow.ts
 *
 * Requires the Next.js dev server running in another terminal
 * (npm run dev) since this hits real API routes over HTTP,
 * exactly like the frontend would.
 */
import "dotenv/config";

const BASE_URL = "http://localhost:3000/api";

async function main() {
  // 1. Create a company (until a POST /companies route exists,
  // this assumes one was already created via Prisma Studio —
  // replace with a real companyId from your database)
  const companyId = process.env.TEST_COMPANY_ID;
  if (!companyId) {
    throw new Error(
      "Set TEST_COMPANY_ID in .env to an existing company's id (create one via Prisma Studio first: npx prisma studio)"
    );
  }
  console.log("DEBUG - companyId being used:", JSON.stringify(companyId));

  // 2. Create an employee with a real funded testnet wallet
  console.log("Creating employee...");
  const employeeRes = await fetch(`${BASE_URL}/employees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId,
      fullName: "Test Employee",
      email: `test-${Date.now()}@example.com`,
      stellarWallet: process.env.TEST_EMPLOYEE_WALLET, // must be a real, funded testnet public key
    }),
  });
  const employeeData = await employeeRes.json();
  if (!employeeRes.ok) {
    throw new Error(`Failed to create employee: ${JSON.stringify(employeeData)}`);
  }
  const employee = employeeData.employee;
  console.log("Created employee:", employee.id);

  // 3. Create a payroll run with one item for this employee
  console.log("\nCreating payroll run...");
  const runRes = await fetch(`${BASE_URL}/payroll-runs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      companyId,
      items: [{ employeeId: employee.id, amountUsdc: "50000000" }], // 5 USDC (7 decimals)
    }),
  });
  const runData = await runRes.json();
  if (!runRes.ok) {
    throw new Error(`Failed to create payroll run: ${JSON.stringify(runData)}`);
  }
  console.log("DEBUG - full runData:", JSON.stringify(runData, null, 2));
  const payrollItem = runData.items[0];
  console.log("Created payroll item:", payrollItem.id);

  // 4. Initiate the SEP-24 withdraw
  console.log("\nInitiating withdraw...");
  const withdrawRes = await fetch(
    `${BASE_URL}/payroll-items/${payrollItem.id}/initiate-withdraw`,
    { method: "POST" }
  );
  const withdrawData = await withdrawRes.json();
  if (!withdrawRes.ok) {
    throw new Error(`Failed to initiate withdraw: ${JSON.stringify(withdrawData)}`);
  }
  console.log("Interactive URL (open this to complete the anchor's form):");
  console.log(withdrawData.interactiveUrl);
  console.log("Anchor transaction id:", withdrawData.anchorTransactionId);

  // 5. Check status (won't be DISBURSED until the interactive form
  // above is actually completed by a human, and the anchor processes it)
  console.log("\nChecking status...");
  const statusRes = await fetch(
    `${BASE_URL}/payroll-items/${payrollItem.id}/check-status`
  );
  const statusData = await statusRes.json();
  console.log("Status result:", statusData);

  console.log(
    "\n✅ Flow completed up to interactive step. Open the URL above, complete the form, then re-run just the check-status call to see it progress."
  );
}

main().catch((err) => {
  console.error("\n❌ Test failed:", err);
  process.exit(1);
});