import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { fetchActiveAnnouncements } from "@/lib/announcements";
import {
  formatReservationDateTime,
  formatReservationTimeRange,
  formatSubmittedDateTime,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/types/announcement";
import type { ReservationRequest } from "@/types/reservation";

const requestColumns =
  "id, user_id, start_time, end_time, group_members_details, equipment_needs, status, admin_note, created_at, updated_at";

export default async function DashboardPage() {
  const { user, profile } = await requireProfile();
  const supabase = await createClient();
  let query = supabase.from("reservation_requests").select(requestColumns);

  if (profile.role !== "admin") {
    query = query.eq("user_id", user.id);
  }

  const [{ data }, { announcements }] = await Promise.all([
    query.order("start_time", { ascending: true }),
    fetchActiveAnnouncements(supabase),
  ]);
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
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">
          {profile.role}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Dashboard</h1>
      </div>
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/calendar"
          className="rounded-md bg-ink px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
        >
          View Calendar
        </Link>
        <Link
          href="/reservations"
          className="rounded-md border border-slate-300 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-white sm:w-auto"
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
      <AnnouncementsSection announcements={announcements} />
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
            actionHref="/calendar"
            actionLabel="Find a slot"
            emptyText="You do not have upcoming approved reservations."
            requests={upcomingApproved}
            title="Upcoming approved reservations"
          />
          <DashboardRequestSection
            actionHref="/calendar"
            actionLabel="Request a slot"
            emptyText="You do not have requests waiting for admin decision."
            requests={pendingRequests}
            title="Pending requests"
          />
        </div>
      )}
    </section>
  );
}

function AnnouncementsSection({
  announcements,
}: {
  announcements: Announcement[];
}) {
  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-ink">Announcements</h2>
      <div className="mt-4 space-y-4">
        {announcements.length ? (
          announcements.map((announcement) => (
            <article
              key={announcement.id}
              className="rounded-md border border-slate-200 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <h3 className="font-semibold text-slate-900">
                  {announcement.title}
                </h3>
                <p className="shrink-0 text-xs font-medium text-slate-500">
                  {formatReservationDateTime(announcement.created_at)}
                </p>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                {announcement.body}
              </p>
            </article>
          ))
        ) : (
          <EmptyState text="No active announcements." />
        )}
      </div>
    </section>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
    </div>
  );
}

function DashboardRequestSection({
  actionHref,
  actionLabel,
  emptyText,
  requests,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  emptyText: string;
  requests: ReservationRequest[];
  title: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
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
              <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                {request.group_members_details}
              </p>
              <p className="mt-2 text-xs font-medium text-slate-500">
                {formatSubmittedDateTime(request.created_at)}
              </p>
            </article>
          ))
        ) : (
          <EmptyState actionHref={actionHref} actionLabel={actionLabel} text={emptyText} />
        )}
      </div>
    </div>
  );
}

function EmptyState({
  actionHref,
  actionLabel,
  text,
}: {
  actionHref?: string;
  actionLabel?: string;
  text: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
      <p>{text}</p>
      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="mt-3 inline-flex w-full justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}
