// Single source of truth for payroll item status.
// Anchor (SEP-24) statuses and on-chain confirmations both map into this enum
// so the frontend only ever needs to render ONE status vocabulary.

export type ItemStatus =
  | "PENDING"
  | "CONVERTING"
  | "DISBURSING"
  | "DISBURSED"
  | "FAILED";

// SEP-24 anchor statuses per the spec: incomplete, pending_anchor,
// pending_stellar, pending_external, completed, error, etc.
export function mapAnchorStatusToItemStatus(anchorStatus: string): ItemStatus {
  switch (anchorStatus) {
    case "incomplete":
      return "PENDING";
    case "pending_anchor":
    case "pending_stellar":
    case "pending_external":
    case "pending_user_transfer_start":
      return "CONVERTING";
    case "completed":
      // Anchor finished converting; on-chain disbursement to employee
      // wallet is a separate step you trigger/confirm afterward.
      return "DISBURSING";
    case "error":
    case "expired":
      return "FAILED";
    default:
      // Unknown anchor status — don't silently assume success.
      return "PENDING";
  }
}
