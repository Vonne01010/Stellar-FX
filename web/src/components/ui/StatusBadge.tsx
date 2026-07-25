import type { RunStatus, ItemStatus } from "@/lib/mock-data";

type Status = RunStatus | ItemStatus;

const STYLES: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  PENDING: { label: "Pending", bg: "bg-void-raised-2", text: "text-star-soft", dot: "bg-star-soft" },
  PROCESSING: { label: "Processing", bg: "bg-amber-soft", text: "text-amber", dot: "bg-amber" },
  CONVERTING: { label: "Converting", bg: "bg-magenta-soft", text: "text-magenta", dot: "bg-magenta" },
  DISBURSING: { label: "Disbursing", bg: "bg-amber-soft", text: "text-amber", dot: "bg-amber" },
  COMPLETED: { label: "Completed", bg: "bg-teal-soft", text: "text-teal", dot: "bg-teal" },
  DISBURSED: { label: "Disbursed", bg: "bg-teal-soft", text: "text-teal", dot: "bg-teal" },
  FAILED: { label: "Failed", bg: "bg-rose-soft", text: "text-rose", dot: "bg-rose" },
};

export default function StatusBadge({ status }: { status: Status }) {
  const s = STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}