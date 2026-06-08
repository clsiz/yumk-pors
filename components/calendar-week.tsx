"use client";

import { useMemo, useState } from "react";
import { createCalendarReservationRequestAction } from "@/app/calendar/actions";
import type { UserRole } from "@/types/profile";
import type { CalendarSlotSummary } from "@/types/reservation";

type CalendarWeekProps = {
  calendarDays: CalendarSlotSummary[][];
  dates: string[];
  role: UserRole;
};

type SelectedSlot = CalendarSlotSummary;

export function CalendarWeek({ calendarDays, dates, role }: CalendarWeekProps) {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const isMember = role === "member";

  return (
    <>
      <div className="mt-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <div className="grid min-w-[88rem] grid-cols-7 divide-x divide-slate-100">
            {calendarDays.map((slots, index) => (
              <div key={dates[index]} className="min-w-[13rem] p-4">
                <p className="text-sm font-semibold text-slate-900">
                  {formatCalendarDate(dates[index])}
                </p>
                <div className="mt-4 space-y-3">
                  {slots.map((slot) => (
                    <CalendarSlotCard
                      key={slot.id}
                      isClickable={isMember && slot.status === "available"}
                      onClick={() => setSelectedSlot(slot)}
                      role={role}
                      slot={slot}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {selectedSlot ? (
        <RequestSlotModal
          onClose={() => setSelectedSlot(null)}
          slot={selectedSlot}
        />
      ) : null}
    </>
  );
}

function CalendarSlotCard({
  isClickable,
  onClick,
  role,
  slot,
}: {
  isClickable: boolean;
  onClick: () => void;
  role: UserRole;
  slot: CalendarSlotSummary;
}) {
  const content = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="whitespace-nowrap text-sm font-semibold text-slate-800">
          {slot.time}
        </span>
        <CalendarStatusBadge status={slot.statusLabel} />
      </div>
      {role === "admin" ? (
        <AdminSlotDetail
          blockTitle={slot.blockTitle}
          requesterName={slot.reservationRequesterName}
          requesterUsername={slot.reservationRequesterUsername}
          status={slot.statusLabel}
        />
      ) : null}
      {role === "member" &&
      slot.status === "available" &&
      slot.pendingCount &&
      slot.pendingCount > 0 ? (
        <p className="truncate text-xs font-medium text-slate-500">
          {formatPendingCount(slot.pendingCount)}
        </p>
      ) : null}
    </>
  );
  const className = `flex min-h-24 w-full flex-col justify-between gap-2 rounded-md border p-3 text-left text-sm transition ${
    isClickable
      ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-accent/30"
      : "border-slate-200 bg-slate-50"
  }`;

  if (isClickable) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

function RequestSlotModal({
  onClose,
  slot,
}: {
  onClose: () => void;
  slot: SelectedSlot;
}) {
  return (
    <div
      aria-labelledby="calendar-request-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6"
      role="dialog"
    >
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="calendar-request-title" className="text-xl font-bold text-ink">
              Request reservation
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {formatCalendarDate(slot.date)} - {slot.time}
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            onClick={onClose}
          >
            Close
          </button>
        </div>
        {slot.pendingCount && slot.pendingCount > 0 ? (
          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {formatPendingCount(slot.pendingCount)} for this slot.
          </div>
        ) : null}
        <form action={createCalendarReservationRequestAction} className="mt-5 space-y-4">
          <input type="hidden" name="date" value={slot.date} />
          <input type="hidden" name="slot" value={slot.slot} />
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Purpose</span>
            <textarea
              name="purpose"
              required
              rows={3}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Participant count
            </span>
            <input
              name="participant_count"
              type="number"
              min={1}
              step={1}
              required
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Equipment needs
            </span>
            <textarea
              name="equipment_needs"
              rows={3}
              className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
          </label>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
            >
              Submit request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AdminSlotDetail({
  blockTitle,
  requesterName,
  requesterUsername,
  status,
}: {
  blockTitle?: string;
  requesterName?: string;
  requesterUsername?: string;
  status: "Available" | "Reserved" | "Closed";
}) {
  const detail = useMemo(() => {
    if (status === "Closed" && blockTitle) {
      return blockTitle;
    }

    if (status === "Reserved" && requesterName) {
      return `${requesterName}${requesterUsername ? ` (${requesterUsername})` : ""}`;
    }

    return null;
  }, [blockTitle, requesterName, requesterUsername, status]);

  if (!detail) {
    return null;
  }

  return <p className="truncate text-xs text-slate-500">{detail}</p>;
}

function CalendarStatusBadge({
  status,
}: {
  status: "Available" | "Reserved" | "Closed";
}) {
  const colorClass =
    status === "Available"
      ? "bg-emerald-100 text-emerald-800"
      : status === "Reserved"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-200 text-slate-700";

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${colorClass}`}>
      {status}
    </span>
  );
}

function formatCalendarDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatPendingCount(count: number) {
  return `${count} pending ${count === 1 ? "request" : "requests"}`;
}
