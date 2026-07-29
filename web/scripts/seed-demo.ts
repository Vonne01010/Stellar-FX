/**
 * Demo seed script — populates the database with a realistic scenario
 * for the final demo: one BPO company, several employees, and a
 * payroll run ready to walk through the SEP-24 flow live.
 *
 * Run with: npx tsx scripts/seed-demo.ts
 *
 * NOTE: employee wallets below are placeholders (all zeros) — replace
 * with real, funded testnet public keys before the actual demo, since
 * the SEP-24/Horizon flow needs real accounts to work against. Use the
 * same keypair-generation + Friendbot steps from earlier in this
 * project's setup to create each one.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";

const DEMO_EMPLOYEES = [
  {
    fullName: "Maria Santos",
    email: "maria.santos@demo.stellarfx.test",
    stellarWallet: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX1", // replace
    amountUsdc: "50000000", // 5 USDC
  },
  {
    fullName: "Jose Reyes",
    email: "jose.reyes@demo.stellarfx.test",
    stellarWallet: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX2", // replace
    amountUsdc: "75000000", // 7.5 USDC
  },
  {
    fullName: "Ana Cruz",
    email: "ana.cruz@demo.stellarfx.test",
    stellarWallet: "GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX3", // replace
    amountUsdc: "60000000", // 6 USDC
  },
];

async function main() {
  console.log("Seeding demo data...\n");

  // 1. Company — reuse if it already exists, so re-running this
  // script doesn't create duplicate demo companies every time.
  let company = await prisma.company.findFirst({
    where: { name: "Demo BPO Co." },
  });

  if (!company) {
    company = await prisma.company.create({
      data: { name: "Demo BPO Co." },
    });
    console.log("Created company:", company.id);
  } else {
    console.log("Reusing existing company:", company.id);
  }

  // 2. Employees — same "reuse if exists" pattern, keyed by email
  // since that's the unique constraint on Employee.
  const employees = [];
  for (const demo of DEMO_EMPLOYEES) {
    let employee = await prisma.employee.findUnique({
      where: { email: demo.email },
    });

    if (!employee) {
      employee = await prisma.employee.create({
        data: {
          companyId: company.id,
          fullName: demo.fullName,
          email: demo.email,
          stellarWallet: demo.stellarWallet,
        },
      });
      console.log(`Created employee: ${employee.fullName} (${employee.id})`);
    } else {
      console.log(`Reusing existing employee: ${employee.fullName} (${employee.id})`);
    }

    employees.push({ employee, amountUsdc: demo.amountUsdc });
  }

  // 3. Payroll run — always create a fresh one, since re-running the
  // seed to demo the flow again should give a clean, untouched run
  // each time rather than reusing one that's already partway through
  // the SEP-24 flow from a previous demo run.
  const totalUsdc = employees.reduce(
    (sum, e) => sum + BigInt(e.amountUsdc),
    BigInt(0)
  );

  const payrollRun = await prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({
      data: { companyId: company!.id, totalUsdc, status: "PENDING" },
    });

    await tx.payrollItem.createMany({
      data: employees.map((e) => ({
        payrollRunId: run.id,
        employeeId: e.employee.id,
        amountUsdc: BigInt(e.amountUsdc),
        status: "PENDING",
      })),
    });

    const createdItems = await tx.payrollItem.findMany({
      where: { payrollRunId: run.id },
    });

    await tx.statusHistory.createMany({
      data: createdItems.map((item) => ({
        payrollItemId: item.id,
        fromStatus: null,
        toStatus: "PENDING",
        note: "Seeded for demo",
      })),
    });

    return { ...run, items: createdItems };
  });

  console.log("\nCreated payroll run:", payrollRun.id);
  console.log(`Total: ${totalUsdc} (smallest units) across ${employees.length} employees`);
  console.log("\nPayroll item ids (use these to walk through initiate-withdraw / check-status live):");
  payrollRun.items.forEach((item, i) => {
    console.log(`  ${employees[i].employee.fullName}: ${item.id}`);
  });

  console.log("\n✅ Demo seed complete.");
  console.log("⚠️  Remember: replace the placeholder GXXXX... wallets above with real, funded testnet addresses before demoing the actual withdraw flow.");
}

main()
  .catch((err) => {
    console.error("Seed script error:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));