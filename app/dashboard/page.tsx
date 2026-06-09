import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import {
  formatReservationDateTime,
  formatReservationTimeRange,
  formatSubmittedDateTime,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import type { ReservationRequest } from "@/types/reservation";

const requestColumns =
  "id, user_id, start_time, end_time, purpose, participant_count, equipment_needs, status, admin_note, created_at, updated_at";

export default async function DashboardPage() {
  const { user, profile } = await requireProfile();
  const supabase = await createClient();
  let query = supabase.from("reservation_requests").select(requestColumns);

  if (profile.role !== "admin") {
    query = query.eq("user_id", user.id);
  }

  const { data } = await query.order("start_time", { ascending: true });
  const requests = (data ?? []) as ReservationRequest[];
  const now = new Date();
  const pendingRequests = requests.filter(
    (request) => request.status === "pending",
  );
  const upcomingApproved = requests.filter(
    (request) =>
      request.status === "approved" && new Date(request.end_time) >= now,
  );
  const historyCount = requests.filter(
    (request) =>
      request.status === "rejected" ||
      request.status === "cancelled" ||
      (request.status === "approved" && new Date(request.end_time) < now),
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
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/calendar"
          className="rounded-md bg-ink px-4 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          View Calendar
        </Link>
        <Link
          href="/reservations"
          className="rounded-md border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-white"
        >
          My Requests
        </Link>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <MetricCard label="Pending requests" value={pendingRequests.length} />
        <MetricCard
          label="Upcoming approved"
          value={upcomingApproved.length}
        />
        {profile.role === "admin" ? (
          <MetricCard label="History items" value={historyCount} />
        ) : null}
      </div>
      {profile.role === "admin" ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-ink">Admin overview</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Use Calendar for slot-level review and Reservations for grouped
            request management and audit history.
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <DashboardRequestSection
            emptyText="You do not have upcoming approved reservations."
            requests={upcomingApproved}
            title="Upcoming approved reservations"
          />
          <DashboardRequestSection
            emptyText="You do not have requests waiting for admin decision."
            requests={pendingRequests}
            title="Pending requests"
          />
        </div>
      )}
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

function DashboardRequestSection({
  emptyText,
  requests,
  title,
}: {
  emptyText: string;
  requests: ReservationRequest[];
  title: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-4">
        {requests.length ? (
          requests.slice(0, 3).map((request) => (
            <article
              key={request.id}
              className="rounded-md border border-slate-200 p-4"
            >
              <p className="font-medium text-slate-900">
                {formatReservationDateTime(request.start_time)}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                {formatReservationTimeRange(
                  request.start_time,
                  request.end_time,
                )}
              </p>
              <p className="mt-2 text-sm text-slate-600">{request.purpose}</p>
              <p className="mt-2 text-xs font-medium text-slate-500">
                {formatSubmittedDateTime(request.created_at)}
              </p>
            </article>
          ))
        ) : (
          <p className="text-sm text-slate-500">{emptyText}</p>
        )}
      </div>
    </div>
  );
}
