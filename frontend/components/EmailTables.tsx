import { EmailJob } from "@/lib/types";
import { EmptyState, Spinner, StatusBadge } from "./ui";

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function Table({
  rows,
  loading,
  emptyTitle,
  emptyDescription,
  dateLabel,
  dateAccessor,
}: {
  rows: EmailJob[];
  loading: boolean;
  emptyTitle: string;
  emptyDescription: string;
  dateLabel: string;
  dateAccessor: (row: EmailJob) => string | null;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">{dateLabel}</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-700">
                {row.recipient_email}
              </td>
              <td className="max-w-xs truncate px-4 py-3 text-slate-600">
                {row.subject}
              </td>
              <td className="px-4 py-3 text-slate-500">
                {formatDate(dateAccessor(row))}
              </td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScheduledTable({
  rows,
  loading,
}: {
  rows: EmailJob[];
  loading: boolean;
}) {
  return (
    <Table
      rows={rows}
      loading={loading}
      emptyTitle="Nothing scheduled yet"
      emptyDescription="Compose a new email to queue up your first send."
      dateLabel="Scheduled time"
      dateAccessor={(r) => r.scheduled_at}
    />
  );
}

export function SentTable({
  rows,
  loading,
}: {
  rows: EmailJob[];
  loading: boolean;
}) {
  return (
    <Table
      rows={rows}
      loading={loading}
      emptyTitle="No emails sent yet"
      emptyDescription="Sent (and failed) emails will show up here once your first campaign runs."
      dateLabel="Sent time"
      dateAccessor={(r) => r.sent_at}
    />
  );
}
