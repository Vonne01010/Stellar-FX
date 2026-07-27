import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7 requires an explicit driver adapter — a bare connection string
// on PrismaClient is no longer accepted.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

// Prevents Next.js dev-mode hot-reloading from spawning a new PrismaClient
// (and a new DB connection pool) on every file save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}