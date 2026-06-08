import { requireAdmin } from "@/lib/auth/session";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { ReservationRequest } from "@/types/reservation";

export default async function AdminPage() {
  const { profile } = await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase
    .from("reservation_requests")
    .select("status");
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
          Admin access
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Admin</h1>
        <p className="mt-2 text-slate-600">
          Manage users and review reservation requests for {profile.full_name}.
        </p>
      </div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Reservation queue</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Metric label="Pending requests" value={pendingCount} />
            <Metric label="Approved reservations" value={approvedCount} />
          </div>
          <Link
            href="/reservations"
            className="mt-5 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Manage requests
          </Link>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">User administration</h2>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            Admin-created users will use username, full name, phone number,
            student number, department, role, and password fields in a later
            milestone.
          </p>
          <div className="mt-5 rounded-md border border-slate-200 p-4">
            <p className="font-medium text-slate-900">Roles</p>
            <p className="mt-1 text-sm text-slate-500">admin, member</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}
