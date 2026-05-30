import { reservations } from "@/lib/reservations";

export default function DashboardPage() {
  const pendingCount = reservations.filter(
    (reservation) => reservation.status === "pending",
  ).length;
  const approvedCount = reservations.filter(
    (reservation) => reservation.status === "approved",
  ).length;

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold text-ink">Dashboard</h1>
        <p className="mt-2 text-slate-600">
          Overview of rehearsal room activity and reservation status.
        </p>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Pending requests" value={pendingCount} />
        <MetricCard label="Approved reservations" value={approvedCount} />
        <MetricCard label="Rooms tracked" value={2} />
      </div>
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Next reservations</h2>
        <div className="mt-4 divide-y divide-slate-100">
          {reservations.slice(0, 3).map((reservation) => (
            <div
              key={reservation.id}
              className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-slate-900">{reservation.band}</p>
                <p className="text-sm text-slate-500">
                  {reservation.room} · {reservation.date} · {reservation.time}
                </p>
              </div>
              <span className="text-sm capitalize text-slate-600">
                {reservation.status}
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
