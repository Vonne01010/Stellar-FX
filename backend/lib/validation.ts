import { z } from "zod";

// Stellar public keys start with "G" and are 56 chars (base32)
const stellarPublicKey = z
  .string()
  .regex(/^G[A-Z0-9]{55}$/, "Must be a valid Stellar public key");

export const createEmployeeSchema = z.object({
  companyId: z.string().cuid(),
  fullName: z.string().min(1),
  email: z.string().email(),
  stellarWallet: stellarPublicKey,
});

export const createPayrollRunSchema = z.object({
  companyId: z.string().cuid(),
  items: z
    .array(
      z.object({
        employeeId: z.string().cuid(),
        amountUsdc: z
          .string() // accept as string to avoid JS number precision issues, convert to BigInt server-side
          .regex(/^\d+$/, "amountUsdc must be a positive integer string (smallest unit)"),
      })
    )
    .min(1, "Payroll run must include at least one employee"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;
