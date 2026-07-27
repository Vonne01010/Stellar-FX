import { z } from "zod";

// Stellar public keys start with "G" and are 56 chars total, using
// RFC 4648 Base32 encoding — which excludes 0, 1, 8, 9 (they're
// dropped because they're visually confusable with O, I, B, S).
// Using [A-Z0-9] instead of [A-Z2-7] would wrongly accept addresses
// that can never actually be valid Stellar keys.
const stellarPublicKey = z
  .string()
  .regex(/^G[A-Z2-7]{55}$/, "Must be a valid Stellar public key");

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