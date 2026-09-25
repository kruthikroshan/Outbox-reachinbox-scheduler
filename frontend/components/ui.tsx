export function Spinner({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-brand-600 ${className}`}
    />
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-slate-400">{description}</p>
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700",
  processing: "bg-amber-50 text-amber-700",
  requeued: "bg-purple-50 text-purple-700",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
        STATUS_STYLES[status] || "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

export function Toast({
  message,
  variant = "error",
  onDismiss,
}: {
  message: string;
  variant?: "error" | "success";
  onDismiss: () => void;
}) {
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-lg px-4 py-3 text-sm shadow-lg ${
        variant === "error"
          ? "bg-red-600 text-white"
          : "bg-emerald-600 text-white"
      }`}
    >
      <span>{message}</span>
      <button onClick={onDismiss} className="text-white/80 hover:text-white">
        ✕
      </button>
    </div>
  );
}
