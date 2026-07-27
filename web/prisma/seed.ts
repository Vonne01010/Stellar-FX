import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Change these before running, or pull from env vars if you'd rather not
// commit a password to your repo.
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@stellarfx.dev";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Demo Admin";
const COMPANY_NAME = process.env.SEED_COMPANY_NAME ?? "Demo BPO Co.";

async function main() {
  const existing = await prisma.employee.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Admin ${ADMIN_EMAIL} already exists — skipping seed.`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  const company = await prisma.company.create({ data: { name: COMPANY_NAME } });

  const admin = await prisma.employee.create({
    data: {
      email: ADMIN_EMAIL,
      fullName: ADMIN_NAME,
      passwordHash,
      role: "ADMIN",
      status: "ACTIVE",
      companyId: company.id,
    },
  });

  console.log("Seeded:");
  console.log(`  Company: ${company.name} (${company.id})`);
  console.log(`  Admin:   ${admin.email} / ${ADMIN_PASSWORD}`);
  console.log("Log in with these credentials at /login.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
