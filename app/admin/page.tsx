import {
  createAnnouncementAction,
  hideAnnouncementAction,
} from "@/app/admin/actions";
import Link from "next/link";
import { fetchAllAnnouncements } from "@/lib/announcements";
import { requireAdmin } from "@/lib/auth/session";
import {
  formatReservationDateTime,
  formatReservationTimeRange,
  RESERVATION_TIME_ZONE,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";
import type { Announcement } from "@/types/announcement";
import type { Profile } from "@/types/profile";
import type { CalendarBlock, ReservationRequest } from "@/types/reservation";

type AdminPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
  }>;
};

type Analytics = {
  totalRequests: number;
  pendingCount: number;
  approvedCount: number;
  rejectedCount: number;
  cancelledCount: number;
  approvalRate: string;
  approvedHours: string;
  blockedSlotCount: number;
  totalUsers: number;
  requestedSlots: RankedItem[];
  requestedDays: RankedItem[];
  equipmentUsage: RankedItem[];
  topUsers: RankedItem[];
};

type RankedItem = {
  label: string;
  value: number;
};

const profileColumns =
  "id, username, full_name, email, phone, student_number, department, role, is_active, created_at";

const requestColumns =
  "id, user_id, start_time, end_time, group_members_details, equipment_needs, status, admin_note, created_at, updated_at";

const calendarBlockColumns =
  "id, start_time, end_time, block_type, title, description, created_by, created_at";

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdmin();
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const [
    { data: requestData, error: requestsError },
    { announcements, error: announcementsError },
    { data: profileData, error: profilesError },
    { data: blockData, error: blocksError },
  ] = await Promise.all([
    supabase
      .from("reservation_requests")
      .select(requestColumns)
      .order("start_time", { ascending: false }),
    fetchAllAnnouncements(supabase),
    supabase
      .from("profiles")
      .select(profileColumns)
      .order("created_at", { ascending: false }),
    supabase
      .from("calendar_blocks")
      .select(calendarBlockColumns)
      .order("start_time", { ascending: false }),
  ]);
  const requests = (requestData ?? []) as ReservationRequest[];
  const users = (profileData ?? []) as Profile[];
  const blocks = (blockData ?? []) as CalendarBlock[];
  const analytics = buildAnalytics(requests, users, blocks);
  const loadError =
    params.error ??
    (announcementsError ||
    requestsError ||
    profilesError ||
    blocksError
      ? "Could not load all admin dashboard data. Check admin data access and try again."
      : undefined);

  return (
    <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-accent">
          Admin access
        </p>
        <h1 className="mt-2 text-3xl font-bold text-ink">Admin</h1>
      </div>
      <StatusMessage error={loadError} notice={params.notice} />
      <AdminOverview analytics={analytics} />
      <AnalyticsSection analytics={analytics} />
      <UserDirectory requests={requests} users={users} />
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

function AdminOverview({ analytics }: { analytics: Analytics }) {
  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-ink">Reservation queue</h2>
          <p className="mt-1 text-sm text-slate-500">
            Current request workload and approved room usage.
          </p>
        </div>
        <Link
          href="/reservations"
          className="inline-flex w-full justify-center rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
        >
          Manage requests
        </Link>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Pending requests" value={analytics.pendingCount} />
        <Metric label="Approved reservations" value={analytics.approvedCount} />
        <Metric label="Approval rate" value={analytics.approvalRate} />
        <Metric label="Approved hours" value={analytics.approvedHours} />
      </div>
    </section>
  );
}

function AnalyticsSection({ analytics }: { analytics: Analytics }) {
  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="text-lg font-semibold text-ink">Analytics</h2>
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total requests" value={analytics.totalRequests} />
        <Metric label="Pending" value={analytics.pendingCount} />
        <Metric label="Approved" value={analytics.approvedCount} />
        <Metric label="Rejected" value={analytics.rejectedCount} />
        <Metric label="Cancelled" value={analytics.cancelledCount} />
        <Metric label="Blocked slots" value={analytics.blockedSlotCount} />
        <Metric label="Users" value={analytics.totalUsers} />
        <Metric label="Approved hours" value={analytics.approvedHours} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RankedList items={analytics.requestedSlots} title="Most requested time slots" />
        <RankedList items={analytics.requestedDays} title="Most requested days" />
        <RankedList items={analytics.equipmentUsage} title="Most used equipment" />
        <RankedList items={analytics.topUsers} title="Top users by approved reservations" />
      </div>
    </section>
  );
}

function UserDirectory({
  requests,
  users,
}: {
  requests: ReservationRequest[];
  users: Profile[];
}) {
  const requestsByUser = groupRequestsByUser(requests);

  return (
    <section className="mt-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-ink">Users</h2>
        <p className="text-sm font-medium text-slate-500">{users.length} total</p>
      </div>
      <div className="mt-5 space-y-4">
        {users.length ? (
          users.map((user) => (
            <UserCard
              key={user.id}
              requests={requestsByUser.get(user.id) ?? []}
              user={user}
            />
          ))
        ) : (
          <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
            No users were found.
          </p>
        )}
      </div>
    </section>
  );
}

function UserCard({
  requests,
  user,
}: {
  requests: ReservationRequest[];
  user: Profile;
}) {
  return (
    <article className="rounded-lg border border-slate-200 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3 className="break-words font-semibold text-slate-900">
            {user.full_name}
          </h3>
          <p className="mt-1 break-words text-sm text-slate-500">
            {user.username}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <RoleBadge role={user.role} />
          <ActiveBadge active={user.is_active} />
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-4">
        <Detail label="Phone" value={user.phone || "-"} />
        <Detail label="Student number" value={user.student_number || "-"} />
        <Detail label="Department" value={user.department || "-"} />
        <Detail label="Email" value={user.email || "-"} />
        <Detail label="Created" value={formatReservationDateTime(user.created_at)} />
      </dl>
      <details className="mt-4 rounded-md border border-slate-200 bg-slate-50/70 p-3">
        <summary className="cursor-pointer text-sm font-semibold text-slate-700">
          Reservation history ({requests.length})
        </summary>
        <div className="mt-3 space-y-3">
          {requests.length ? (
            requests.map((request) => (
              <ReservationHistoryCard key={request.id} request={request} />
            ))
          ) : (
            <p className="text-sm text-slate-500">
              This user has no reservation requests yet.
            </p>
          )}
        </div>
      </details>
    </article>
  );
}

function ReservationHistoryCard({
  request,
}: {
  request: ReservationRequest;
}) {
  return (
    <article className="rounded-md border border-slate-200 bg-white p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-medium text-slate-900">
            {formatReservationDateTime(request.start_time)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {formatReservationTimeRange(request.start_time, request.end_time)}
          </p>
        </div>
        <ReservationStatusBadge status={request.status} />
      </div>
      <dl className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <Detail label="End" value={formatReservationDateTime(request.end_time)} />
        <Detail label="Created" value={formatReservationDateTime(request.created_at)} />
        <Detail
          label="Equipment"
          value={request.equipment_needs || "None specified"}
        />
        <Detail label="Admin note" value={request.admin_note || "-"} />
        <Detail
          label="Group members"
          value={request.group_members_details}
        />
      </dl>
    </article>
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
        className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <h2 className="text-lg font-semibold text-ink">New announcement</h2>
        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Title</span>
            <input
              name="title"
              type="text"
              required
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Body</span>
            <textarea
              name="body"
              required
              rows={5}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
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
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-ink">Announcements</h2>
        <div className="mt-4 space-y-4">
          {announcements.length ? (
            announcements.map((announcement) => (
              <article
                key={announcement.id}
                className="rounded-md border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words font-semibold text-slate-900">
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
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
                    >
                      Hide announcement
                    </button>
                  </form>
                ) : null}
              </article>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
              There are no announcements yet.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/70 p-4">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-ink">{value}</p>
    </div>
  );
}

function RankedList({ items, title }: { items: RankedItem[]; title: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <ol className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 text-sm"
            >
              <span className="min-w-0 break-words text-slate-600">
                {item.label}
              </span>
              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                {item.value}
              </span>
            </li>
          ))
        ) : (
          <li className="text-sm text-slate-500">No data yet.</li>
        )}
      </ol>
    </div>
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

function RoleBadge({ role }: { role: Profile["role"] }) {
  return (
    <span
      className={`h-fit rounded-full px-3 py-1 text-sm font-medium capitalize ${
        role === "admin"
          ? "bg-ink text-white"
          : "bg-slate-100 text-slate-700"
      }`}
    >
      {role}
    </span>
  );
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`h-fit rounded-full px-3 py-1 text-sm font-medium ${
        active
          ? "bg-emerald-50 text-emerald-700"
          : "bg-red-50 text-red-700"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ReservationStatusBadge({
  status,
}: {
  status: ReservationRequest["status"];
}) {
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
    <div className="min-w-0">
      <dt className="font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-slate-900">
        {value}
      </dd>
    </div>
  );
}

function buildAnalytics(
  requests: ReservationRequest[],
  users: Profile[],
  blocks: CalendarBlock[],
): Analytics {
  const pendingCount = countByStatus(requests, "pending");
  const approvedCount = countByStatus(requests, "approved");
  const rejectedCount = countByStatus(requests, "rejected");
  const cancelledCount = countByStatus(requests, "cancelled");
  const approvedHours = requests
    .filter((request) => request.status === "approved")
    .reduce((total, request) => total + getRequestHours(request), 0);
  const approvalRate = requests.length
    ? `${Math.round((approvedCount / requests.length) * 100)}%`
    : "0%";

  return {
    totalRequests: requests.length,
    pendingCount,
    approvedCount,
    rejectedCount,
    cancelledCount,
    approvalRate,
    approvedHours: formatHours(approvedHours),
    blockedSlotCount: blocks.length,
    totalUsers: users.length,
    requestedSlots: rankRequests(requests, getRequestTimeSlot),
    requestedDays: rankRequests(requests, getRequestWeekday),
    equipmentUsage: rankEquipment(requests),
    topUsers: rankTopApprovedUsers(requests, users),
  };
}

function countByStatus(
  requests: ReservationRequest[],
  status: ReservationRequest["status"],
) {
  return requests.filter((request) => request.status === status).length;
}

function groupRequestsByUser(requests: ReservationRequest[]) {
  const grouped = new Map<string, ReservationRequest[]>();

  requests.forEach((request) => {
    const current = grouped.get(request.user_id) ?? [];
    current.push(request);
    grouped.set(request.user_id, current);
  });

  grouped.forEach((userRequests) => {
    userRequests.sort(
      (a, b) =>
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime(),
    );
  });

  return grouped;
}

function rankRequests(
  requests: ReservationRequest[],
  getLabel: (request: ReservationRequest) => string,
) {
  const counts = new Map<string, number>();

  requests.forEach((request) => {
    const label = getLabel(request);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return rankCounts(counts);
}

function rankEquipment(requests: ReservationRequest[]) {
  const counts = new Map<string, number>();

  requests.forEach((request) => {
    request.equipment_needs
      ?.split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((item) => {
        counts.set(item, (counts.get(item) ?? 0) + 1);
      });
  });

  return rankCounts(counts);
}

function rankTopApprovedUsers(
  requests: ReservationRequest[],
  users: Profile[],
) {
  const usersById = new Map(users.map((user) => [user.id, user]));
  const counts = new Map<string, number>();

  requests
    .filter((request) => request.status === "approved")
    .forEach((request) => {
      const user = usersById.get(request.user_id);
      const label = user
        ? `${user.full_name} (${user.username})`
        : "Unknown user";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    });

  return rankCounts(counts);
}

function rankCounts(counts: Map<string, number>) {
  return Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
    .slice(0, 5);
}

function getRequestTimeSlot(request: ReservationRequest) {
  return formatReservationTimeRange(request.start_time, request.end_time);
}

function getRequestWeekday(request: ReservationRequest) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    timeZone: RESERVATION_TIME_ZONE,
  }).format(new Date(request.start_time));
}

function getRequestHours(request: ReservationRequest) {
  const start = new Date(request.start_time).getTime();
  const end = new Date(request.end_time).getTime();

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return 0;
  }

  return (end - start) / (1000 * 60 * 60);
}

function formatHours(hours: number) {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}
