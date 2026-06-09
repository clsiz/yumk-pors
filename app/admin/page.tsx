import {
  createAnnouncementAction,
  hideAnnouncementAction,
} from "@/app/admin/actions";
import Link from "next/link";
import { fetchAllAnnouncements } from "@/lib/announcements";
import { requireAdmin } from "@/lib/auth/session";
import { formatReservationDateTime } from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/types/announcement";
import type { ReservationRequest } from "@/types/reservation";

type AdminPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const { profile } = await requireAdmin();
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const [{ data }, { announcements, error: announcementsError }] =
    await Promise.all([
      supabase.from("reservation_requests").select("status"),
      fetchAllAnnouncements(supabase),
    ]);
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
      <StatusMessage
        error={
          params.error ??
          (announcementsError ? "Could not load announcements." : undefined)
        }
        notice={params.notice}
      />
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
      <AnnouncementManagement announcements={announcements} />
    </section>
  );
}

function StatusMessage({
  error,
  notice,
}: {
  error?: string;
  notice?: string;
}) {
  if (!error && !notice) {
    return null;
  }

  return (
    <div
      className={`mt-6 rounded-md border px-4 py-3 text-sm ${
        error
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {error ?? notice}
    </div>
  );
}

function AnnouncementManagement({
  announcements,
}: {
  announcements: Announcement[];
}) {
  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
      <form
        action={createAnnouncementAction}
        className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-ink">New announcement</h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Title</span>
            <input
              name="title"
              type="text"
              required
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Body</span>
            <textarea
              name="body"
              required
              rows={5}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </label>
        </div>
        <button
          type="submit"
          className="mt-6 w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          Create announcement
        </button>
      </form>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-ink">Announcements</h2>
        <div className="mt-4 space-y-4">
          {announcements.length ? (
            announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="rounded-md border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {announcement.title}
                    </h3>
                    <p className="mt-1 text-xs font-medium text-slate-500">
                      {formatReservationDateTime(announcement.created_at)}
                    </p>
                  </div>
                  <AnnouncementStatus active={announcement.is_active} />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
                  {announcement.body}
                </p>
                {announcement.is_active ? (
                  <form action={hideAnnouncementAction} className="mt-4">
                    <input
                      type="hidden"
                      name="announcement_id"
                      value={announcement.id}
                    />
                    <button
                      type="submit"
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Hide announcement
                    </button>
                  </form>
                ) : null}
              </article>
            ))
          ) : (
            <p className="text-sm text-slate-500">
              There are no announcements yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function AnnouncementStatus({ active }: { active: boolean }) {
  return (
    <span
      className={`h-fit rounded-full px-3 py-1 text-sm font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {active ? "Active" : "Hidden"}
    </span>
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
