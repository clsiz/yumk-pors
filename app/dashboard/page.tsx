import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ReservationRequest } from "@/types/reservation";

export default async function DashboardPage() {
  const { user, profile } = await requireProfile();
  const supabase = await createClient();
  let query = supabase.from("reservation_requests").select("status");

  if (profile.role !== "admin") {
    query = query.eq("user_id", user.id);
  }

  const { data } = await query;
  const requests = (data ?? []) as Pick<ReservationRequest, "status">[];
  const pendingCount = requests.filter(
    (request) => request.status === "pending",
  ).length;
  const approvedCount = requests.filter(
    (request) => request.status === "approved",
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
        <MetricCard label="Approved reservations" value={approvedCount} />
        <MetricCard label="Room count" value={1} />
      </div>
      <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Reservation workflow</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Use Reservations to create requests and review their status. Use
          Calendar to check anonymous availability for approved reservations and
          closed slots.
        </p>
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
