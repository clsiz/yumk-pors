import {
  approveReservationRequestAction,
  cancelApprovedReservationAction,
  cancelOwnPendingRequestAction,
  rejectReservationRequestAction,
} from "@/app/reservations/actions";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import {
  fetchAdminReservationRequests,
  fetchMemberReservationRequests,
  formatReservationDateTime,
  formatReservationTimeRange,
  formatSubmittedDateTime,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import type {
  AdminReservationRequest,
  ReservationRequest,
} from "@/types/reservation";

type ReservationsPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
};

export default async function ReservationsPage({
  searchParams,
}: ReservationsPageProps) {
  const { user, profile } = await requireProfile();
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};

  if (profile.role === "admin") {
    const { requests, error } = await fetchAdminReservationRequests(supabase);

    return (
      <ReservationsShell
        title="Reservation Requests"
        description="Review and manage all reservation requests for the rehearsal room."
        notice={params.notice}
        error={params.error ?? (error ? "Could not load reservation requests." : undefined)}
      >
        <AdminRequestSections requests={requests} />
      </ReservationsShell>
    );
  }

  const { requests, error } = await fetchMemberReservationRequests(
    supabase,
    user.id,
  );

  return (
    <ReservationsShell
      title="My Reservation Requests"
      description="Review your own reservation requests and cancellation status."
      notice={params.notice}
      error={params.error ?? (error ? "Could not load your reservation requests." : undefined)}
    >
      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <MemberCalendarCallout />
        <MemberRequestList requests={requests} />
      </div>
    </ReservationsShell>
  );
}

function MemberCalendarCallout() {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">Request a new slot</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        To request a new rehearsal slot, choose an available time from the Calendar.
      </p>
      <Link
        href="/calendar"
        className="mt-5 inline-flex rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Open Calendar
      </Link>
    </div>
  );
}

function ReservationsShell({
  title,
  description,
  notice,
  error,
  children,
}: {
  title: string;
  description: string;
  notice?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div>
        <h1 className="text-3xl font-bold text-ink">{title}</h1>
        <p className="mt-2 text-slate-600">{description}</p>
      </div>
      <StatusMessage notice={notice} error={error} />
      <div className="mt-8">{children}</div>
    </section>
  );
}

function StatusMessage({
  notice,
  error,
}: {
  notice?: string;
  error?: string;
}) {
  if (!notice && !error) {
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

function MemberRequestList({ requests }: { requests: ReservationRequest[] }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-ink">My requests</h2>
      <div className="mt-4 space-y-4">
        {requests.length ? (
          requests.map((request) => (
            <article
              key={request.id}
              className="rounded-md border border-slate-200 p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-medium text-slate-900">
                    {formatReservationDateTime(request.start_time)}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatReservationTimeRange(
                      request.start_time,
                      request.end_time,
                    )}
                  </p>
                  <p className="mt-2 text-xs font-medium text-slate-500">
                    {formatSubmittedDateTime(request.created_at)}
                  </p>
                </div>
                <StatusBadge status={request.status} />
              </div>
              <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <Detail
                  label="Group members"
                  value={request.group_members_details}
                />
                <Detail
                  label="Equipment"
                  value={request.equipment_needs || "None specified"}
                />
                <Detail label="Admin note" value={request.admin_note || "-"} />
              </dl>
              {request.status === "pending" ? (
                <form action={cancelOwnPendingRequestAction} className="mt-4">
                  <input type="hidden" name="request_id" value={request.id} />
                  <button
                    type="submit"
                    className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    Cancel pending request
                  </button>
                </form>
              ) : null}
            </article>
          ))
        ) : (
          <p className="text-sm text-slate-500">
            You do not have any reservation requests yet.
          </p>
        )}
      </div>
    </div>
  );
}

function AdminRequestSections({
  requests,
}: {
  requests: AdminReservationRequest[];
}) {
  const now = new Date();
  const pendingRequests = requests.filter(
    (request) => request.status === "pending",
  );
  const upcomingApproved = requests.filter(
    (request) =>
      request.status === "approved" && new Date(request.end_time) >= now,
  );
  const history = requests.filter(
    (request) =>
      request.status === "rejected" ||
      request.status === "cancelled" ||
      (request.status === "approved" && new Date(request.end_time) < now),
  );

  return (
    <div className="space-y-8">
      <AdminRequestSection
        emptyText="There are no pending requests."
        requests={pendingRequests}
        showActions
        title="Pending Requests"
      />
      <AdminRequestSection
        emptyText="There are no upcoming approved reservations."
        requests={upcomingApproved}
        showActions
        title="Upcoming Approved Reservations"
      />
      <AdminRequestSection
        emptyText="There is no reservation history yet."
        requests={history}
        title="History"
      />
    </div>
  );
}

function AdminRequestSection({
  emptyText,
  requests,
  showActions = false,
  title,
}: {
  emptyText: string;
  requests: AdminReservationRequest[];
  showActions?: boolean;
  title: string;
}) {
  return (
    <section>
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600">
          {requests.length}
        </span>
      </div>
      <div className="mt-4 space-y-5">
      {requests.length ? (
        requests.map((request) => (
          <article
            key={request.id}
            className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-ink">
                  {request.requester?.full_name ?? "Unknown requester"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {request.requester?.username ?? "missing-profile"}
                </p>
                <p className="mt-2 text-xs font-medium text-slate-500">
                  {formatSubmittedDateTime(request.created_at)}
                </p>
              </div>
              <StatusBadge status={request.status} />
            </div>
            <dl className="mt-5 grid gap-4 text-sm text-slate-600 md:grid-cols-2 lg:grid-cols-3">
              <Detail label="Phone" value={request.requester?.phone || "-"} />
              <Detail
                label="Student number"
                value={request.requester?.student_number || "-"}
              />
              <Detail
                label="Department"
                value={request.requester?.department || "-"}
              />
              <Detail label="Email" value={request.requester?.email || "-"} />
              <Detail
                label="Start"
                value={formatReservationDateTime(request.start_time)}
              />
              <Detail
                label="End"
                value={formatReservationDateTime(request.end_time)}
              />
              <Detail
                label="Group members"
                value={request.group_members_details}
              />
              <Detail
                label="Equipment"
                value={request.equipment_needs || "None specified"}
              />
              <Detail label="Admin note" value={request.admin_note || "-"} />
            </dl>
            {showActions ? <AdminActions request={request} /> : null}
          </article>
        ))
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          {emptyText}
        </div>
      )}
      </div>
    </section>
  );
}

function AdminActions({ request }: { request: ReservationRequest }) {
  if (request.status === "pending") {
    return (
      <div className="mt-5 grid gap-3 lg:grid-cols-[auto_1fr]">
        <form action={approveReservationRequestAction}>
          <input type="hidden" name="request_id" value={request.id} />
          <button
            type="submit"
            className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Approve
          </button>
        </form>
        <form action={rejectReservationRequestAction} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="request_id" value={request.id} />
          <input
            name="admin_note"
            type="text"
            placeholder="Optional admin note"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
          <button
            type="submit"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reject
          </button>
        </form>
      </div>
    );
  }

  if (request.status === "approved") {
    return (
      <form action={cancelApprovedReservationAction} className="mt-5 flex flex-col gap-2 sm:flex-row">
        <input type="hidden" name="request_id" value={request.id} />
        <input
          name="admin_note"
          type="text"
          placeholder="Optional cancellation note"
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
        <button
          type="submit"
          className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
        >
          Cancel reservation
        </button>
      </form>
    );
  }

  return null;
}

function StatusBadge({ status }: { status: ReservationRequest["status"] }) {
  const colorClass =
    status === "approved"
      ? "bg-emerald-50 text-emerald-700"
      : status === "pending"
        ? "bg-amber-50 text-amber-700"
        : status === "rejected"
          ? "bg-red-50 text-red-700"
          : "bg-slate-100 text-slate-700";

  return (
    <span
      className={`h-fit rounded-full px-3 py-1 text-sm font-medium capitalize ${colorClass}`}
    >
      {status}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-slate-900">{value}</dd>
    </div>
  );
}
