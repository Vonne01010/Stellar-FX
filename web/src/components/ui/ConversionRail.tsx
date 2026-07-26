import type { ItemStatus } from "@/lib/mock-data";

const STAGES: { key: ItemStatus; label: string }[] = [
  { key: "PENDING", label: "Funded" },
  { key: "CONVERTING", label: "Converting" },
  { key: "DISBURSING", label: "Disbursing" },
  { key: "DISBURSED", label: "Disbursed" },
];

function stageIndex(status: ItemStatus): number {
  if (status === "FAILED") return -1;
  return STAGES.findIndex((s) => s.key === status);
}

export default function ConversionRail({ status }: { status: ItemStatus }) {
  const current = stageIndex(status);
  const failed = status === "FAILED";

  return (
    <div
      className="flex items-center"
      role="img"
      aria-label={`Payment status: ${status.toLowerCase()}`}
    >
      {STAGES.map((stage, i) => {
        const reached = !failed && i <= current;
        const isCurrent = !failed && i === current;
        const lineActive = !failed && i < current;

        return (
          <div key={stage.key} className="flex items-center">
            <div className="flex flex-col items-center">
              <span
                className={[
                  "h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full transition-colors",
                  failed && i === 0 ? "bg-rose" : "",
                  reached && !isCurrent ? "bg-teal" : "",
                  isCurrent ? "bg-violet shadow-[0_0_0_3px_var(--violet-glow)]" : "",
                  !reached && !failed ? "bg-void-raised-2 border border-line" : "",
                ].join(" ")}
              />
              {/* labels hidden on mobile, shown from sm: up to save horizontal space */}
              <span
                className={`mt-1.5 hidden text-[11px] sm:block ${
                  reached ? "text-star-soft" : "text-star-soft/50"
                }`}
              >
                {stage.label}
              </span>
            </div>
            {i < STAGES.length - 1 && (
              <div
                className={[
                  "h-px w-4 sm:w-10 mx-1",
                  failed && i === 0 ? "bg-rose" : lineActive ? "bg-teal" : "bg-line",
                ].join(" ")}
              />
            )}
          </div>
        );
      })}
      {failed && (
        <span className="ml-2 text-[11px] text-rose">
          Failed at {STAGES[Math.max(current, 0)]?.label ?? "funding"}
        </span>
      )}
    </div>
  );
}