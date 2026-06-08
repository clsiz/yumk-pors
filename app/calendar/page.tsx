import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import {
  buildCalendarSlotSummaries,
  fetchApprovedReservationsForRange,
  fetchCalendarBlocksForRange,
  getCalendarDates,
  getReservationSlotRange,
  RESERVATION_SLOTS,
} from "@/lib/reservations";
import { createClient } from "@/lib/supabase/server";

export default async function CalendarPage() {
  const { profile } = await requireProfile();
  const supabase = await createClient();
  const dates = getCalendarDates(7);
  const firstRange = getReservationSlotRange(dates[0], RESERVATION_SLOTS[0]);
  const lastRange = getReservationSlotRange(
    dates[dates.length - 1],
    RESERVATION_SLOTS[RESERVATION_SLOTS.length - 1],
  );

  const [{ requests, error: requestsError }, { blocks, error: blocksError }] =
    firstRange && lastRange
      ? await Promise.all([
          fetchApprovedReservationsForRange(
            supabase,
            firstRange.startTime,
            lastRange.endTime,
          ),
          fetchCalendarBlocksForRange(
            supabase,
            firstRange.startTime,
            lastRange.endTime,
          ),
        ])
      : [
          { requests: [], error: null },
          { blocks: [], error: null },
        ];

  const calendarDays = buildCalendarSlotSummaries(dates, requests, blocks);
  const loadError =
    requestsError || blocksError
      ? "Could not load calendar availability. Try again later."
      : undefined;

  return (
    <section className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-ink">Calendar</h1>
          <p className="mt-2 text-slate-600">
            Anonymous availability for the single rehearsal room.
          </p>
        </div>
        {profile.role === "admin" ? (
          <Link
            href="/reservations"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Manage requests
          </Link>
        ) : null}
      </div>
      {loadError ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}
      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-7 md:divide-x md:divide-y-0">
          {calendarDays.map((slots, index) => (
            <div key={dates[index]} className="min-h-[28rem] p-4">
              <p className="text-sm font-semibold text-slate-900">
                {formatCalendarDate(dates[index])}
              </p>
              <div className="mt-4 space-y-3">
                {slots.map((slot) => (
                  <div
                    key={slot.id}
                    className="rounded-md border border-slate-200 p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium text-slate-700">
                        {slot.time}
                      </span>
                      <CalendarStatusBadge status={slot.statusLabel} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function formatCalendarDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function CalendarStatusBadge({
  status,
}: {
  status: "Available" | "Reserved" | "Closed";
}) {
  const colorClass =
    status === "Available"
      ? "bg-emerald-50 text-emerald-700"
      : status === "Reserved"
        ? "bg-amber-50 text-amber-700"
        : "bg-slate-100 text-slate-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${colorClass}`}>
      {status}
    </span>
  );
}
