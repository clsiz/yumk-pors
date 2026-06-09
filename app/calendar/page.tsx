import Link from "next/link";
import { CalendarWeek } from "@/components/calendar-week";
import { requireProfile } from "@/lib/auth/session";
import {
  buildCalendarSlotSummaries,
  CALENDAR_RANGE_DAYS,
  fetchAdminCalendarBlocksForRange,
  fetchAdminCalendarRequestsForRange,
  fetchAdminCalendarAvailability,
  fetchCalendarPendingRequestCounts,
  fetchMemberCalendarBlockDetails,
  fetchMemberCalendarAvailability,
  getCalendarDates,
  getLocalDateString,
  getReservationSlotRange,
  isLocalDateString,
  RESERVATION_SLOTS,
  shiftLocalDate,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";

type CalendarPageProps = {
  searchParams?: Promise<{
    notice?: string;
    error?: string;
    start?: string;
  }>;
};

export default async function CalendarPage({ searchParams }: CalendarPageProps) {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const params = searchParams ? await searchParams : {};
  const today = getLocalDateString(new Date());
  const startDate = params.start && isLocalDateString(params.start)
    ? params.start
    : today;
  const dates = getCalendarDates(CALENDAR_RANGE_DAYS, startDate);
  const previousStartDate = shiftLocalDate(startDate, -CALENDAR_RANGE_DAYS);
  const nextStartDate = shiftLocalDate(startDate, CALENDAR_RANGE_DAYS);
  const firstRange = getReservationSlotRange(dates[0], RESERVATION_SLOTS[0]);
  const lastRange = getReservationSlotRange(
    dates[dates.length - 1],
    RESERVATION_SLOTS[RESERVATION_SLOTS.length - 1],
  );
  const fetchCalendarAvailability =
    profile.role === "admin"
      ? fetchAdminCalendarAvailability
      : fetchMemberCalendarAvailability;

  const [
    { availability, error: availabilityError },
    { pendingCounts, error: pendingCountsError },
    { requests: adminRequests, error: adminRequestsError },
    { blocks: adminBlocks, error: adminBlocksError },
    { blockDetails: memberBlockDetails },
  ] =
    firstRange && lastRange
      ? await Promise.all([
          fetchCalendarAvailability(
            supabase,
            firstRange.startTime,
            lastRange.endTime,
          ),
          fetchCalendarPendingRequestCounts(
            supabase,
            firstRange.startTime,
            lastRange.endTime,
          ),
          profile.role === "admin"
            ? fetchAdminCalendarRequestsForRange(
                supabase,
                firstRange.startTime,
                lastRange.endTime,
              )
            : Promise.resolve({ requests: [], error: null }),
          profile.role === "admin"
            ? fetchAdminCalendarBlocksForRange(
                supabase,
                firstRange.startTime,
                lastRange.endTime,
              )
            : Promise.resolve({ blocks: [], error: null }),
          profile.role === "member"
            ? fetchMemberCalendarBlockDetails(
                supabase,
                firstRange.startTime,
                lastRange.endTime,
              )
            : Promise.resolve({ blockDetails: [], error: null }),
        ])
      : [
          { availability: [], error: null },
          { pendingCounts: [], error: null },
          { requests: [], error: null },
          { blocks: [], error: null },
          { blockDetails: [] },
        ];

  const calendarDays = buildCalendarSlotSummaries(
    dates,
    availability,
    pendingCounts,
    profile.role === "admin"
      ? { adminRequests, adminBlocks }
      : { memberBlockDetails },
  );
  const loadError =
    params.error ||
    (availabilityError ||
    pendingCountsError ||
    adminRequestsError ||
    adminBlocksError
      ? "Could not load calendar availability. Try again later."
      : undefined);

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Calendar</h1>
          <p className="mt-2 text-slate-600">
            30-day availability for the single rehearsal room.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:items-end">
          {profile.role === "admin" ? (
            <Link
              href="/reservations"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
            >
              Manage requests
            </Link>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <CalendarRangeLink href={`/calendar?start=${previousStartDate}`}>
              Previous 30 days
            </CalendarRangeLink>
            <CalendarRangeLink href="/calendar">Today</CalendarRangeLink>
            <CalendarRangeLink href={`/calendar?start=${nextStartDate}`}>
              Next 30 days
            </CalendarRangeLink>
          </div>
        </div>
      </div>
      <StatusMessage error={loadError} notice={params.notice} />
      <CalendarWeek calendarDays={calendarDays} dates={dates} role={profile.role} />
    </section>
  );
}

function CalendarRangeLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
    >
      {children}
    </Link>
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
