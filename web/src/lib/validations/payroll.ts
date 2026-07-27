import { z } from "zod";

// One line item within a new payroll run: which employee, how much USDC.
// Amount is a string here (not a number) on purpose — see note below.
const payrollLineItemSchema = z.object({
  employeeId: z.string().cuid({ message: "employeeId must be a valid id" }),
  amountUsdc: z
    .string()
    .regex(/^\d+$/, "amountUsdc must be a whole number string, in smallest units (no decimals, no letters)"),
});

export const createPayrollRunSchema = z.object({
  companyId: z.string().cuid({ message: "companyId must be a valid id" }),
  items: z
    .array(payrollLineItemSchema)
    .min(1, "A payroll run must include at least one employee"),
});

export type CreatePayrollRunInput = z.infer<typeof createPayrollRunSchema>;

/*
  Why amountUsdc is validated as a STRING of digits, not a number:

  JSON itself has no concept of BigInt — numbers in JSON are IEEE-754
  doubles, the same floating-point type that causes rounding errors.
  If someone sends { "amountUsdc": 123456789012345 } and that number
  is large enough, JSON.parse can silently lose precision before your
  code ever sees it — you'd be handing corrupted payroll amounts into
  a route meant to prevent exactly that.

  Sending it as a STRING sidesteps this entirely: "123456789012345"
  round-trips through JSON perfectly, and you convert it to BigInt
  yourself in the route handler with BigInt(value), where you're in
  full control of the conversion.
*/