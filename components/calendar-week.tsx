"use client";

import { useMemo, useState } from "react";
import {
  createCalendarBlockAction,
  createCalendarReservationRequestAction,
  createFullDayCalendarBlocksAction,
  deleteCalendarBlockAction,
} from "@/app/calendar/actions";
import {
  approveReservationRequestAction,
  cancelApprovedReservationAction,
  rejectReservationRequestAction,
} from "@/app/reservations/actions";
import { RESERVATION_EQUIPMENT_OPTIONS } from "@/lib/reservations";
import type { UserRole } from "@/types/profile";
import type {
  AdminReservationRequest,
  CalendarBlock,
  CalendarSlotSummary,
  ReservationRequest,
} from "@/types/reservation";

type CalendarWeekProps = {
  calendarDays: CalendarSlotSummary[][];
  dates: string[];
  role: UserRole;
};

type SelectedSlot = CalendarSlotSummary;
type SelectedDay = {
  date: string;
};

const RESERVATION_TIME_ZONE = "Europe/Istanbul";

export function CalendarWeek({ calendarDays, dates, role }: CalendarWeekProps) {
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [selectedDay, setSelectedDay] = useState<SelectedDay | null>(null);
  const isMember = role === "member";
  const isAdmin = role === "admin";

  return (
    <>
      <div className="mt-6 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm sm:mt-8">
        <div className="overflow-x-auto">
          <div className="grid min-w-[360rem] grid-cols-[repeat(30,minmax(12rem,1fr))] divide-x divide-slate-100">
            {calendarDays.map((slots, index) => (
              <div key={dates[index]} className="min-w-[12rem] p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold leading-5 text-slate-900">
                    {formatCalendarDate(dates[index])}
                  </p>
                  {isAdmin ? (
                    <button
                      type="button"
                      aria-label={`Block ${formatCalendarDate(dates[index])}`}
                      className="shrink-0 rounded-md border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
                      onClick={() => setSelectedDay({ date: dates[index] })}
                      title="Block full day"
                    >
                      Block
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 space-y-3">
                  {slots.map((slot) => {
                    const isClickable =
                      (isMember && slot.status === "available" && !slot.isPast) ||
                      (isAdmin && isAdminClickableSlot(slot));

                    return (
                      <CalendarSlotCard
                        key={slot.id}
                        isClickable={isClickable}
                        onClick={() => setSelectedSlot(slot)}
                        role={role}
                        slot={slot}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {selectedSlot && isMember ? (
        <RequestSlotModal
          onClose={() => setSelectedSlot(null)}
          slot={selectedSlot}
        />
      ) : null}
      {selectedSlot && isAdmin ? (
        <AdminSlotModal
          onClose={() => setSelectedSlot(null)}
          slot={selectedSlot}
        />
      ) : null}
      {selectedDay && isAdmin ? (
        <FullDayBlockModal
          date={selectedDay.date}
          onClose={() => setSelectedDay(null)}
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
      <div className="flex items-start justify-between gap-2">
        <span className="whitespace-nowrap text-sm font-semibold text-slate-800">
          {slot.time}
        </span>
        <CalendarStatusBadge status={slot.statusLabel} />
      </div>
      {role === "admin" ? (
        <AdminSlotDetail
          blockTitle={slot.blockTitle}
          pendingCount={slot.pendingRequests?.length ?? 0}
          requesterName={slot.reservationRequesterName}
          requesterUsername={slot.reservationRequesterUsername}
          status={slot.statusLabel}
        />
      ) : null}
      {role === "member" && slot.status === "closed" ? (
        <MemberClosedSlotDetail
          description={slot.blockDescription}
          title={slot.blockTitle}
        />
      ) : null}
      {role === "member" &&
      slot.status === "available" &&
      slot.pendingCount &&
      slot.pendingCount > 0 ? (
        <p className="text-xs font-medium leading-5 text-slate-500">
          {formatPendingCount(slot.pendingCount)}
        </p>
      ) : null}
      {slot.isPast ? (
        <p className="text-xs font-medium leading-5 text-slate-500">Past slot</p>
      ) : null}
    </>
  );
  const className = getSlotCardClassName(slot, isClickable);

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
    <ModalFrame labelledBy="calendar-request-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="calendar-request-title" className="text-xl font-bold text-ink">
            Request reservation
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {formatCalendarDate(slot.date)} - {slot.time}
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      {slot.pendingCount && slot.pendingCount > 0 ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {formatPendingCount(slot.pendingCount)} for this slot.
        </div>
      ) : null}
      <form action={createCalendarReservationRequestAction} className="mt-5 space-y-5">
        <input type="hidden" name="date" value={slot.date} />
        <input type="hidden" name="slot" value={slot.slot} />
        <label className="block">
          <span className="text-sm font-medium text-slate-700">
            Group members information
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">
            Please list each group member&apos;s full name, student number, and phone number.
          </span>
          <textarea
            name="group_members_details"
            required
            rows={5}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm leading-6 outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
        </label>
        <fieldset className="rounded-md border border-slate-200 bg-slate-50/60 p-4">
          <legend className="px-1 text-sm font-medium text-slate-700">
            Equipment needs
          </legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {RESERVATION_EQUIPMENT_OPTIONS.map((option) => (
              <label
                key={option}
                className="flex items-start gap-3 rounded-md bg-white px-3 py-2 text-sm leading-5 text-slate-700 ring-1 ring-slate-200"
              >
                <input
                  name="equipment_needs"
                  type="checkbox"
                  value={option}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-accent focus:ring-accent"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
          <p>
            By submitting this request, I confirm that I will leave the rehearsal
            room clean and organized, use electronic equipment only as shown in
            the training, contact a Music Club officer immediately if any problem
            occurs, and cancel my request as early as possible if I cannot attend.
          </p>
          <label className="mt-4 flex items-start gap-3 rounded-md bg-white/70 p-3 font-medium">
            <input
              name="usage_rules"
              type="checkbox"
              required
              value="accepted"
              className="mt-1 h-4 w-4 shrink-0 rounded border-amber-300 text-accent focus:ring-accent"
            />
            <span>I have read and agree to these usage rules.</span>
          </label>
        </div>
        <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
          >
            Submit request
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function AdminSlotModal({
  onClose,
  slot,
}: {
  onClose: () => void;
  slot: SelectedSlot;
}) {
  const pendingRequests = slot.pendingRequests ?? [];

  return (
    <ModalFrame labelledBy="admin-slot-title" size="wide">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="admin-slot-title" className="text-xl font-bold text-ink">
            Slot details
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {formatCalendarDate(slot.date)} - {slot.time}
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <div className="mt-6 space-y-5">
        {slot.status === "available" ? (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Create block
            </h3>
            <SingleSlotBlockForm slot={slot} />
          </section>
        ) : null}
        {pendingRequests.length ? (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Pending requests
            </h3>
            <div className="mt-3 space-y-4">
              {pendingRequests.map((request) => (
                <AdminPendingRequestCard key={request.id} request={request} />
              ))}
            </div>
          </section>
        ) : null}
        {slot.approvedRequest ? (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Approved reservation
            </h3>
            <AdminApprovedRequestCard request={slot.approvedRequest} />
          </section>
        ) : null}
        {slot.block ? (
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Calendar block
            </h3>
            <AdminCalendarBlockCard block={slot.block} />
          </section>
        ) : null}
      </div>
    </ModalFrame>
  );
}

function SingleSlotBlockForm({ slot }: { slot: CalendarSlotSummary }) {
  return (
    <form
      action={createCalendarBlockAction}
      className="mt-3 rounded-md border border-slate-200 p-4"
    >
      <input type="hidden" name="date" value={slot.date} />
      <input type="hidden" name="slot" value={slot.slot} />
      <input type="hidden" name="block_type" value="manual" />
      <div className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">
        {formatCalendarDate(slot.date)} - {slot.time}
      </div>
      <div className="mt-4 space-y-4">
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
          <span className="text-sm font-medium text-slate-700">
            Description
          </span>
          <textarea
            name="description"
            rows={3}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
        </label>
      </div>
      <button
        type="submit"
        className="mt-4 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        Block this slot
      </button>
    </form>
  );
}

function FullDayBlockModal({
  date,
  onClose,
}: {
  date: string;
  onClose: () => void;
}) {
  return (
    <ModalFrame labelledBy="full-day-block-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="full-day-block-title" className="text-xl font-bold text-ink">
            Block full day
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {formatCalendarDate(date)} - 10:00-18:00
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </div>
      <form action={createFullDayCalendarBlocksAction} className="mt-5 space-y-4">
        <input type="hidden" name="date" value={date} />
        <input type="hidden" name="block_type" value="manual" />
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
          <span className="text-sm font-medium text-slate-700">
            Description
          </span>
          <textarea
            name="description"
            rows={3}
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="w-full rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-full rounded-md bg-ink px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 sm:w-auto"
          >
            Block full day
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}

function AdminPendingRequestCard({
  request,
}: {
  request: AdminReservationRequest;
}) {
  return (
    <article className="rounded-md border border-slate-200 p-4">
      <AdminRequestDetails request={request} />
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr]">
        <form action={approveReservationRequestAction} className="space-y-2">
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="redirect_to" value="/calendar" />
          <input
            name="admin_note"
            type="text"
            placeholder="Optional approval note"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
          <button
            type="submit"
            className="w-full rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800"
          >
            Approve
          </button>
        </form>
        <form action={rejectReservationRequestAction} className="space-y-2">
          <input type="hidden" name="request_id" value={request.id} />
          <input type="hidden" name="redirect_to" value="/calendar" />
          <input
            name="admin_note"
            type="text"
            placeholder="Optional rejection note"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
          <button
            type="submit"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Reject
          </button>
        </form>
      </div>
    </article>
  );
}

function AdminApprovedRequestCard({
  request,
}: {
  request: AdminReservationRequest;
}) {
  return (
    <article className="mt-3 rounded-md border border-slate-200 p-4">
      <AdminRequestDetails request={request} />
      <form action={cancelApprovedReservationAction} className="mt-4 space-y-2">
        <input type="hidden" name="request_id" value={request.id} />
        <input type="hidden" name="redirect_to" value="/calendar" />
        <input
          name="admin_note"
          type="text"
          placeholder="Optional cancellation note"
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
        />
        <button
          type="submit"
          className="w-full rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 sm:w-auto"
        >
          Cancel reservation
        </button>
      </form>
    </article>
  );
}

function AdminCalendarBlockCard({ block }: { block: CalendarBlock }) {
  return (
    <article className="mt-3 rounded-md border border-slate-200 p-4">
      <h4 className="font-semibold text-slate-900">{block.title}</h4>
      <dl className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <Detail label="Type" value={block.block_type} />
        <Detail label="Start" value={formatDateTime(block.start_time)} />
        <Detail label="End" value={formatDateTime(block.end_time)} />
        <Detail label="Description" value={block.description || "-"} />
      </dl>
      <form action={deleteCalendarBlockAction} className="mt-4">
        <input type="hidden" name="block_id" value={block.id} />
        <button
          type="submit"
          className="w-full rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50 sm:w-auto"
        >
          Remove block
        </button>
      </form>
    </article>
  );
}

function MemberClosedSlotDetail({
  description,
  title,
}: {
  description?: string;
  title?: string;
}) {
  if (!title && !description) {
    return null;
  }

  return (
    <div className="space-y-1 text-xs text-red-700">
      {title ? <p className="truncate font-medium">{title}</p> : null}
      {description ? <p className="line-clamp-2 text-red-600">{description}</p> : null}
    </div>
  );
}

function AdminRequestDetails({ request }: { request: AdminReservationRequest }) {
  return (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="font-semibold text-slate-900">
            {request.requester?.full_name ?? "Unknown requester"}
          </h4>
          <p className="mt-1 text-sm text-slate-500">
            {request.requester?.username ?? "missing-profile"}
          </p>
        </div>
        <StatusBadge status={request.status} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
        <Detail label="Phone" value={request.requester?.phone || "-"} />
        <Detail
          label="Student number"
          value={request.requester?.student_number || "-"}
        />
        <Detail label="Department" value={request.requester?.department || "-"} />
        <Detail label="Email" value={request.requester?.email || "-"} />
        <Detail label="Submitted" value={formatSubmittedDateTime(request.created_at)} />
        <Detail label="Start" value={formatDateTime(request.start_time)} />
        <Detail label="End" value={formatDateTime(request.end_time)} />
        <Detail label="Time" value={formatTimeRange(request.start_time, request.end_time)} />
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
    </>
  );
}

function AdminSlotDetail({
  blockTitle,
  pendingCount,
  requesterName,
  requesterUsername,
  status,
}: {
  blockTitle?: string;
  pendingCount: number;
  requesterName?: string;
  requesterUsername?: string;
  status: "Available" | "Reserved" | "Closed";
}) {
  const detail = useMemo(() => {
    const details: string[] = [];

    if (pendingCount > 0) {
      details.push(formatPendingCount(pendingCount));
    }

    if (status === "Closed" && blockTitle) {
      details.push(blockTitle);
    }

    if (status === "Reserved" && requesterName) {
      details.push(`${requesterName}${requesterUsername ? ` (${requesterUsername})` : ""}`);
    }

    return details.join(" | ");
  }, [blockTitle, pendingCount, requesterName, requesterUsername, status]);

  if (!detail) {
    return null;
  }

  return <p className="line-clamp-2 text-xs leading-5 text-slate-500">{detail}</p>;
}

function ModalFrame({
  children,
  labelledBy,
  size = "normal",
}: {
  children: React.ReactNode;
  labelledBy: string;
  size?: "normal" | "wide";
}) {
  const widthClass = size === "wide" ? "max-w-3xl" : "max-w-lg";

  return (
    <div
      aria-labelledby={labelledBy}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-3 py-4 sm:px-4 sm:py-6"
      role="dialog"
    >
      <div className={`max-h-[92vh] w-full overflow-y-auto rounded-lg bg-white p-4 shadow-xl sm:p-6 ${widthClass}`}>
        {children}
      </div>
    </div>
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      className="rounded-md px-2 py-1 text-sm font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
      onClick={onClose}
    >
      Close
    </button>
  );
}

function CalendarStatusBadge({
  status,
}: {
  status: "Available" | "Reserved" | "Closed";
}) {
  const colorClass =
    status === "Available"
      ? "bg-emerald-100 text-emerald-800 ring-1 ring-emerald-200"
      : status === "Reserved"
        ? "bg-amber-100 text-amber-800 ring-1 ring-amber-200"
        : "bg-red-100 text-red-800 ring-1 ring-red-200";

  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${colorClass}`}>
      {status}
    </span>
  );
}

function getSlotCardClassName(slot: CalendarSlotSummary, isClickable: boolean) {
  const base =
    "flex min-h-24 w-full flex-col justify-between gap-2 rounded-md border p-3 text-left text-sm transition";

  if (slot.isPast) {
    return `${base} border-slate-200 bg-slate-100 text-slate-500`;
  }

  if (slot.status === "closed") {
    return `${base} border-red-200 bg-red-50/70 ${
      isClickable
        ? "hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-200"
        : ""
    }`;
  }

  if (slot.status === "reserved") {
    return `${base} border-amber-200 bg-amber-50/70`;
  }

  if (isClickable) {
    return `${base} border-emerald-200 bg-emerald-50/60 hover:border-emerald-400 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-accent/30`;
  }

  return `${base} border-slate-200 bg-slate-50`;
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

function isAdminClickableSlot(slot: CalendarSlotSummary) {
  return Boolean(
    slot.status === "available" ||
      slot.pendingRequests?.length ||
      slot.approvedRequest ||
      (slot.status === "closed" && slot.block),
  );
}

function formatCalendarDate(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: RESERVATION_TIME_ZONE,
  }).format(new Date(value));
}

function formatSubmittedDateTime(value: string) {
  return formatDateTime(value);
}

function formatTimeRange(startTime: string, endTime: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: RESERVATION_TIME_ZONE,
  });

  return `${formatter.format(new Date(startTime))} - ${formatter.format(
    new Date(endTime),
  )}`;
}

function formatPendingCount(count: number) {
  return `${count} pending ${count === 1 ? "request" : "requests"}`;
}
