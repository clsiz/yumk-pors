import { requireProfile } from "@/lib/auth/session";
import { calendarSlotSummaries } from "@/lib/reservations";

export default async function DashboardPage() {
  const { profile } = await requireProfile();
  const pendingCount = calendarSlotSummaries.filter(
    (slot) => slot.status === "pending",
  ).length;
  const reservedCount = calendarSlotSummaries.filter(
    (slot) => slot.status === "reserved",
  ).length;

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">
          {profile.role}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Overview of rehearsal room activity for {profile.full_name}.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Pending requests" value={pendingCount} />
        <MetricCard label="Reserved slots" value={reservedCount} />
        <MetricCard label="Room count" value={1} />
      </div>
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Upcoming slot status</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {calendarSlotSummaries.slice(0, 3).map((slot) => (
            <div
              key={slot.id}
              className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{slot.label}</p>
                <p className="text-sm text-slate-500">
                  {slot.date} - {slot.time}
                </p>
              </div>
              <span className="text-sm capitalize text-slate-600">
                {slot.statusLabel}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}
